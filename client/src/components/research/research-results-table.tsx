import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { researchApi, getTypeColor, type ResearchProgram } from "@/lib/researchApi";

export default function ResearchResultsTable() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);

  // Fetch all results
  const { data: allResults, isLoading } = useQuery({
    queryKey: ['/api/research/results'],
    queryFn: () => researchApi.getResults(),
  });

  // Memoized filtering logic with safe array handling
  const filteredResults = useMemo(() => {
    const safeResults = Array.isArray(allResults) ? allResults : [];
    if (safeResults.length === 0) return [];

    return safeResults.filter(result => {
      // Text search on title
      const matchesSearch = searchQuery === "" || 
        result.title.toLowerCase().includes(searchQuery.toLowerCase());

      // State filter
      const matchesState = selectedStates.length === 0 || 
        selectedStates.includes(result.state);

      // Type filter
      const matchesType = selectedTypes.length === 0 || 
        selectedTypes.includes(result.type);

      return matchesSearch && matchesState && matchesType;
    });
  }, [allResults, searchQuery, selectedStates, selectedTypes]);

  // Get unique values for filter chips with safe array handling
  const availableStates = useMemo(() => {
    const safeResults = Array.isArray(allResults) ? allResults : [];
    if (safeResults.length === 0) return [];
    const states = new Set(safeResults.map(r => r.state));
    return Array.from(states).sort();
  }, [allResults]);

  const availableTypes = useMemo(() => {
    const safeResults = Array.isArray(allResults) ? allResults : [];
    if (safeResults.length === 0) return [];
    const types = new Set(safeResults.map(r => r.type));
    return Array.from(types).sort();
  }, [allResults]);

  const handleStateFilter = (state: string) => {
    setSelectedStates(prev => 
      prev.includes(state) 
        ? prev.filter(s => s !== state)
        : [...prev, state]
    );
  };

  const handleTypeFilter = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStates([]);
    setSelectedTypes([]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading results...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></i>
              <Input
                placeholder="Search program titles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-programs"
              />
            </div>

            {/* Filter Chips */}
            <div className="space-y-3">
              {/* State Filters */}
              {availableStates.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Filter by State:</div>
                  <div className="flex flex-wrap gap-2">
                    {availableStates.map(state => (
                      <Button
                        key={state}
                        variant={selectedStates.includes(state) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleStateFilter(state)}
                        data-testid={`filter-state-${state}`}
                      >
                        {state}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Type Filters */}
              {availableTypes.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-2">Filter by Type:</div>
                  <div className="flex flex-wrap gap-2">
                    {availableTypes.map(type => (
                      <Button
                        key={type}
                        variant={selectedTypes.includes(type) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleTypeFilter(type)}
                        data-testid={`filter-type-${type}`}
                      >
                        {type}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear Filters */}
              {(searchQuery || selectedStates.length > 0 || selectedTypes.length > 0) && (
                <div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <i className="fas fa-times mr-2"></i>
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>

            {/* Results Count */}
            <div className="text-sm text-muted-foreground">
              Showing {filteredResults.length} of {allResults?.length || 0} programs
              {(searchQuery || selectedStates.length > 0 || selectedTypes.length > 0) && ' (filtered)'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardContent className="p-0">
          {filteredResults.length === 0 ? (
            <div className="text-center py-12">
              {!allResults || allResults.length === 0 ? (
                <>
                  <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
                  <h3 className="text-lg font-medium text-foreground mb-2">No Research Results</h3>
                  <p className="text-muted-foreground mb-4">
                    Run a research job to see compliance programs and regulations
                  </p>
                </>
              ) : (
                <>
                  <i className="fas fa-filter text-4xl text-muted-foreground mb-4"></i>
                  <h3 className="text-lg font-medium text-foreground mb-2">No Results Match Filters</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search terms or clearing filters
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear All Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>State</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.map((result) => (
                    <TableRow key={result.id} data-testid={`result-row-${result.id}`}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono">
                          {result.state}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${getTypeColor(result.type)}`}>
                          {result.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="font-medium">{result.title}</div>
                        {result.summary && (
                          <div className="text-sm text-muted-foreground mt-1 truncate">
                            {result.summary}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {result.lastUpdated ? formatDate(result.lastUpdated) : 'Unknown'}
                      </TableCell>
                      <TableCell>
                        {result.url ? (
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm"
                            data-testid={`link-source-${result.id}`}
                          >
                            <i className="fas fa-external-link-alt mr-1"></i>
                            View Source
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-sm">No link</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}