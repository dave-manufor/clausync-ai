import { PubSub } from '@google-cloud/pubsub';

const projectId = process.env.GCP_PROJECT_ID || 'clausync-ai-dev';

const pubSubClient = new PubSub({
    projectId
});

export const publishMessage = async (topicName: string, data: any) => {
    try {
        // Assume topicName includes specific topic ID, or we prepend a prefix if needed
        // SADD: cmd.scrape_url
        
        const dataBuffer = Buffer.from(JSON.stringify(data));
        const messageId = await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
        console.log(`Message ${messageId} published to topic ${topicName}`);
        return messageId;
    } catch (error: any) {
        console.error(`Received error while publishing to ${topicName}: ${error.message}`);
        throw error;
    }
};
