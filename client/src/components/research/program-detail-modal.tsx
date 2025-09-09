import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type ResearchProgram } from "@/lib/researchApi";

interface ProgramDetailModalProps {
  program: ResearchProgram | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProgramDetailModal({ 
  program, 
  open, 
  onOpenChange 
}: ProgramDetailModalProps) {
  if (!program) return null;

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTypeColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'registration': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'inspection': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'insurance': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'licensing': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100';
      case 'emissions': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'compliant': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'non-compliant': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
      case 'verified': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" data-testid="program-detail-modal">
        <SheetHeader className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <SheetTitle className="text-xl font-semibold pr-8">
                {program.title}
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {program.state}
                </Badge>
                <Badge className={`text-xs ${getTypeColor(program.type)}`}>
                  {program.type}
                </Badge>
              </div>
            </div>
          </div>
          <SheetDescription className="text-sm text-muted-foreground">
            Detailed program information and compliance requirements
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Summary Section */}
          {program.summary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium">
                  <i className="fas fa-info-circle text-blue-500 mr-2"></i>
                  Summary
                </h3>
              </div>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm leading-relaxed text-foreground">
                  {program.summary}
                </p>
              </div>
            </div>
          )}

          {/* Program Details Section */}
          {(program.effectiveDate || program.lastUpdated) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium">
                  <i className="fas fa-calendar text-green-500 mr-2"></i>
                  Program Details
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                {program.effectiveDate && (
                  <div className="space-y-2">
                    <label className="font-medium text-muted-foreground">Effective Date</label>
                    <p className="text-foreground">{formatDate(program.effectiveDate)}</p>
                  </div>
                )}
                {program.lastUpdated && (
                  <div className="space-y-2">
                    <label className="font-medium text-muted-foreground">Last Updated</label>
                    <p className="text-foreground">{formatDate(program.lastUpdated)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Source Information */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">
                <i className="fas fa-link text-indigo-500 mr-2"></i>
                Source Information
              </h3>
            </div>
            <div className="grid gap-4">
              {/* Source URL */}
              {program.url && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Source URL
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted/50 rounded px-3 py-2">
                      <p className="text-sm font-mono text-foreground break-all">
                        {program.url}
                      </p>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => copyToClipboard(program.url || '')}
                            data-testid="button-copy-url"
                          >
                            <i className="fas fa-copy text-xs"></i>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy URL</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(program.url, '_blank')}
                            data-testid="button-open-source"
                          >
                            <i className="fas fa-external-link-alt text-xs"></i>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Open in new tab</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  {/* Source validation status */}
                  {program.sourceValid !== undefined && (
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={program.sourceValid ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {program.sourceValid ? (
                          <><i className="fas fa-check mr-1"></i>Valid</>
                        ) : (
                          <><i className="fas fa-times mr-1"></i>Invalid</>
                        )}
                      </Badge>
                      {program.httpStatus && (
                        <Badge variant="outline" className="text-xs font-mono">
                          HTTP {program.httpStatus}
                        </Badge>
                      )}
                      {program.sourceReason && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <i className="fas fa-info-circle text-muted-foreground text-xs"></i>
                            </TooltipTrigger>
                            <TooltipContent>
                              {program.sourceReason}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Version Information */}
              {program.version && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Version
                  </label>
                  <Badge variant="outline" className="text-xs">
                    v{program.version}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Metadata Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-medium">
                <i className="fas fa-tags text-gray-500 mr-2"></i>
                Metadata
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <label className="font-medium text-muted-foreground">Program ID</label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted/50 px-2 py-1 rounded text-xs font-mono">
                    {program.id}
                  </code>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                    onClick={() => copyToClipboard(program.id)}
                  >
                    <i className="fas fa-copy text-xs"></i>
                  </Button>
                </div>
              </div>

              {program.jobId && (
                <div className="space-y-2">
                  <label className="font-medium text-muted-foreground">Research Job ID</label>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted/50 px-2 py-1 rounded text-xs font-mono">
                      {program.jobId}
                    </code>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 w-6 p-0 opacity-60 hover:opacity-100"
                      onClick={() => copyToClipboard(program.jobId || '')}
                    >
                      <i className="fas fa-copy text-xs"></i>
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="font-medium text-muted-foreground">Created Date</label>
                <p className="text-foreground">{formatDate(program.createdAt)}</p>
              </div>

              <div className="space-y-2">
                <label className="font-medium text-muted-foreground">Valid From</label>
                <p className="text-foreground">{formatDate(program.validFrom)}</p>
              </div>

              {program.checkedAt && (
                <div className="space-y-2">
                  <label className="font-medium text-muted-foreground">Last Validated</label>
                  <p className="text-foreground">{formatDate(program.checkedAt)}</p>
                </div>
              )}

              {program.isDemo && (
                <div className="space-y-2">
                  <label className="font-medium text-muted-foreground">Data Type</label>
                  <Badge variant="outline" className="text-xs">
                    <i className="fas fa-flask mr-1"></i>
                    Demo Data
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}