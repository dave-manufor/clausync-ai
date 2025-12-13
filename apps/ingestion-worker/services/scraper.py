import logging
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
from bs4 import BeautifulSoup
from markdownify import markdownify as md
import config

logger = logging.getLogger(__name__)

# Wait strategies in order of preference
WAIT_STRATEGIES = [
    {"wait_until": "networkidle", "timeout": 30000},  # Best for static pages
    {"wait_until": "domcontentloaded", "timeout": 30000},  # Good for SPAs
    {"wait_until": "load", "timeout": 20000},  # Last resort
]

def fetch_content(url: str, selector: str = "body") -> tuple[str | None, str | None]:
    """
    Fetch content using Playwright with optional proxy support.
    Uses tiered wait strategies to handle both static and SPA sites.
    Returns tuple of (raw_html, markdown_text).
    """
    proxy_config = None
    if config.settings.proxy_url:
        proxy_config = {
            "server": config.settings.proxy_url
        }
        logger.info("Using proxy for request", extra={"proxy_host": config.settings.PROXY_HOST})
    
    with sync_playwright() as p:
        browser_args = {
            "headless": True,
        }
        if proxy_config:
            browser_args["proxy"] = proxy_config
            
        browser = p.chromium.launch(**browser_args)
        
        # Stealth-like configuration
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
        )
        
        # Block unnecessary resources for faster loading
        context.route("**/*.{png,jpg,jpeg,gif,svg,ico,woff,woff2}", lambda route: route.abort())
        
        page = context.new_page()
        try:
            logger.info(f"Navigating to {url}")
            
            # Try each wait strategy until one succeeds
            navigation_success = False
            for i, strategy in enumerate(WAIT_STRATEGIES):
                try:
                    logger.info(f"Trying wait strategy: {strategy['wait_until']} (attempt {i + 1}/{len(WAIT_STRATEGIES)})")
                    page.goto(url, wait_until=strategy["wait_until"], timeout=strategy["timeout"])
                    navigation_success = True
                    logger.info(f"Navigation successful with strategy: {strategy['wait_until']}")
                    break
                except PlaywrightTimeout:
                    if i < len(WAIT_STRATEGIES) - 1:
                        logger.warning(f"Strategy {strategy['wait_until']} timed out, trying next strategy...")
                    else:
                        logger.warning(f"All wait strategies timed out, attempting to scrape current page state")
                        # Even if timeout, the page may have loaded enough content
                        navigation_success = True
            
            if not navigation_success:
                logger.error(f"Failed to navigate to {url}")
                return None, None
            
            # Wait for content to stabilize
            page.wait_for_timeout(2000)
            
            raw_html = page.content()
            
            # Parse and extract selected content
            soup = BeautifulSoup(raw_html, 'html.parser')
            
            # Remove script and style elements
            for element in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
                element.decompose()
            
            selected_content = soup.select_one(selector)
            
            if not selected_content:
                logger.warning(f"Selector {selector} not found on {url}, falling back to body")
                selected_content = soup.body
                
            if not selected_content:
                logger.error(f"No content found on {url}")
                return None, None
            
            html_str = str(selected_content)
            
            # Convert to Markdown for semantic diffing
            markdown_text = md(html_str, heading_style="ATX", strip=['a', 'img'])
            
            # Clean up excessive whitespace in markdown
            lines = [line.strip() for line in markdown_text.split('\n') if line.strip()]
            markdown_text = '\n\n'.join(lines)
                
            return html_str, markdown_text
            
        except Exception as e:
            logger.error(f"Error fetching {url}: {e}")
            return None, None
        finally:
            browser.close()

