import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  AlertCircle,
  FileText,
  ExternalLink,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  FileType,
  Lightbulb,
  User,
} from 'lucide-react'
import { useState } from 'react'
import { Button } from '@clausync/ui'
import { Badge } from '@clausync/ui'
import { Card, CardContent, CardHeader, CardTitle } from '@clausync/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@clausync/ui'
import { Skeleton } from '@clausync/ui'
import { useChange } from '@/lib/api-hooks'
import { getRiskLevel, type DiffJson, type ChangeItem, type KeySection } from '@/types'

const riskLevelConfig = {
  low: { label: 'Low Risk', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  medium: { label: 'Medium Risk', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  high: { label: 'High Risk', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
}

export function ChangeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState('summary')
  
  const { data: change, isLoading, error } = useChange(id || '')

  // Computed values
  const riskLevel = change ? getRiskLevel(change.globalRiskScore) : 'low'
  const riskConfig = riskLevelConfig[riskLevel]
  const diffJson = change?.diffJson as DiffJson | null
  const isInitialBaseline = diffJson?.is_initial_baseline ?? false

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">Failed to load change details</p>
        <Button asChild variant="outline">
          <Link to="/changes">Back to Changes</Link>
        </Button>
      </div>
    )
  }

  if (isLoading || !change) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        to="/changes"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Changes
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">
              {isInitialBaseline ? 'Initial Analysis' : 'Change Detected'}
            </h1>
            <Badge variant="outline" className={riskConfig.color}>
              {riskConfig.label} ({change.globalRiskScore ?? 0}/10)
            </Badge>
            {diffJson?.document_type && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <FileType className="h-3 w-3" />
                {diffJson.document_type.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              {change.displayName || change.resource?.urlNormalized || 'Unknown Resource'}
            </span>
            <a
              href={change.resource?.urlNormalized || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-accent transition-colors"
            >
              View Source <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {isInitialBaseline ? 'Analyzed' : 'Detected'} {new Date(change.createdAt).toLocaleString()}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button variant="outline" size="sm">
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-surface-2/50">
          <TabsTrigger value="summary" className="data-[state=active]:bg-primary/20">
            <Sparkles className="h-4 w-4 mr-2" />
            AI Summary
          </TabsTrigger>
          <TabsTrigger value="details" className="data-[state=active]:bg-primary/20">
            <FileText className="h-4 w-4 mr-2" />
            {isInitialBaseline ? 'Document Review' : 'Full Diff'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          {/* Risk Rationale Card */}
          {diffJson?.risk_rationale && (
            <Card className={`border-l-4 ${riskLevel === 'high' ? 'border-l-red-500' : riskLevel === 'medium' ? 'border-l-amber-500' : 'border-l-emerald-500'}`}>
              <CardContent className="p-4 flex items-start gap-4">
                <div className={`p-2 rounded-lg ${riskLevel === 'high' ? 'bg-red-500/10' : riskLevel === 'medium' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                  <AlertTriangle className={`h-5 w-5 ${riskLevel === 'high' ? 'text-red-500' : riskLevel === 'medium' ? 'text-amber-500' : 'text-emerald-500'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Risk Assessment</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {diffJson.risk_rationale}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                AI Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-invert prose-sm max-w-none">
                {(change.globalAiSummary || 'No AI summary available.').split('\n\n').map((paragraph, i) => (
                  <p key={i} className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {paragraph}
                  </p>
                ))}
              </div>
              {change.riskKeywords && change.riskKeywords.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {change.riskKeywords.map((keyword, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Personalized Analysis - "What This Means for You" */}
          {change.personalizedAnalysis && (
            <Card className="border-l-4 border-l-accent">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-accent">
                  <User className="h-5 w-5" />
                  What This Means for You
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-invert prose-sm max-w-none">
                  {change.personalizedAnalysis.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Red Flags & Positive Indicators for Initial Baseline */}
          {isInitialBaseline && (
            <div className="grid md:grid-cols-2 gap-4">
              {diffJson?.red_flags && diffJson.red_flags.length > 0 && (
                <Card className="border-red-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-red-400 text-base">
                      <ShieldAlert className="h-5 w-5" />
                      Red Flags ({diffJson.red_flags.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {diffJson.red_flags.map((flag, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-red-400 mt-1">•</span>
                          {flag}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {diffJson?.positive_indicators && diffJson.positive_indicators.length > 0 && (
                <Card className="border-emerald-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-emerald-400 text-base">
                      <ShieldCheck className="h-5 w-5" />
                      Positive Indicators ({diffJson.positive_indicators.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {diffJson.positive_indicators.map((indicator, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="text-emerald-400 mt-1">•</span>
                          {indicator}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Recommendation for Comparison */}
          {!isInitialBaseline && diffJson?.recommendation && (
            <Card className="border-accent/20">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="p-2 rounded-lg bg-accent/10">
                  <Lightbulb className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Recommendation</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {diffJson.recommendation}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {/* Key Sections for Initial Baseline */}
          {isInitialBaseline && diffJson?.key_sections && diffJson.key_sections.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  Document Sections
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(diffJson.key_sections as KeySection[]).map((section, index) => {
                    const indicatorColors = {
                      low: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
                      medium: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                      high: 'bg-red-500/10 border-red-500/30 text-red-400',
                    }
                    const concernConfig = {
                      low: { color: 'text-emerald-400', Icon: ShieldCheck },
                      medium: { color: 'text-amber-400', Icon: AlertTriangle },
                      high: { color: 'text-red-400', Icon: AlertTriangle },
                    }
                    const config = concernConfig[section.risk_indicator] || concernConfig.medium
                    return (
                      <div
                        key={index}
                        className={`rounded-lg border p-4 ${indicatorColors[section.risk_indicator] || indicatorColors.medium}`}
                      >
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-white">{section.section}</h4>
                          <Badge variant="outline" className={indicatorColors[section.risk_indicator]}>
                            {section.risk_indicator}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{section.description}</p>
                        {section.concern && (
                          <p className={`text-sm ${config.color} mt-2 flex items-start gap-1`}>
                            <config.Icon className="h-4 w-4 shrink-0 mt-0.5" />
                            {section.concern}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Changes for Comparison */}
          {!isInitialBaseline && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-accent" />
                  Document Changes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {diffJson?.changes && diffJson.changes.length > 0 ? (
                  <div className="space-y-4">
                    {(diffJson.changes as ChangeItem[]).map((item, index) => {
                      const changeTypeConfig = {
                        added: { 
                          label: 'Added', 
                          bg: 'bg-emerald-500/10', 
                          border: 'border-emerald-500/30',
                          text: 'text-emerald-400',
                          icon: '+',
                          iconBg: 'bg-emerald-500/20'
                        },
                        removed: { 
                          label: 'Removed', 
                          bg: 'bg-red-500/10', 
                          border: 'border-red-500/30',
                          text: 'text-red-400',
                          icon: '−',
                          iconBg: 'bg-red-500/20'
                        },
                        modified: { 
                          label: 'Modified', 
                          bg: 'bg-amber-500/10', 
                          border: 'border-amber-500/30',
                          text: 'text-amber-400',
                          icon: '~',
                          iconBg: 'bg-amber-500/20'
                        },
                      }
                      const config = changeTypeConfig[item.change_type] || changeTypeConfig.modified

                      const riskDeltaIcon = item.risk_delta === 'increased' 
                        ? <TrendingUp className="h-4 w-4 text-red-400" />
                        : item.risk_delta === 'decreased'
                        ? <TrendingDown className="h-4 w-4 text-emerald-400" />
                        : <Minus className="h-4 w-4 text-muted-foreground" />

                      return (
                        <div
                          key={index}
                          className={`rounded-lg border ${config.border} ${config.bg} p-4 transition-all hover:border-opacity-60`}
                        >
                          {/* Header */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${config.iconBg} ${config.text} font-bold text-lg shrink-0`}>
                              {config.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-white">{item.section}</h4>
                                <Badge variant="outline" className={`${config.bg} ${config.text} border-transparent text-xs`}>
                                  {config.label}
                                </Badge>
                                {item.risk_delta && (
                                  <span className="flex items-center gap-1 text-xs">
                                    {riskDeltaIcon}
                                    <span className={item.risk_delta === 'increased' ? 'text-red-400' : item.risk_delta === 'decreased' ? 'text-emerald-400' : 'text-muted-foreground'}>
                                      Risk {item.risk_delta}
                                    </span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Description */}
                          <div className="ml-11 space-y-3">
                            <p className="text-muted-foreground leading-relaxed">
                              {item.description}
                            </p>
                            
                            {/* Impact */}
                            {item.impact && (
                              <div className="flex items-start gap-2 p-3 rounded-md bg-white/5 border border-white/10">
                                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                <div>
                                  <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">Impact</span>
                                  <p className="text-sm text-muted-foreground mt-0.5">{item.impact}</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="p-4 rounded-full bg-surface-2/50 mb-4">
                      <FileText className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground">No detailed changes available</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      AI analysis didn't detect specific sections to highlight
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
