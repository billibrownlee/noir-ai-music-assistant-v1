import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { 
  Brain, 
  Volume2, 
  BarChart3,
  Layers, 
  Zap, 
  Target,
  Sparkles,
  TrendingUp,
  Music,
  Headphones
} from 'lucide-react';

interface ProductionSuggestion {
  id: string;
  type: 'mixing' | 'arrangement' | 'sound-design' | 'mastering';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
}

const SAMPLE_SUGGESTIONS: ProductionSuggestion[] = [
  {
    id: '1',
    type: 'mixing',
    title: 'Add High-Pass Filter to Vocals',
    description: 'Remove low-end rumble from vocals around 80-100Hz to create cleaner mix separation',
    confidence: 92,
    actionable: true
  },
  {
    id: '2',
    type: 'arrangement',
    title: 'Introduce Bridge Section',
    description: 'Consider adding a bridge around 2:30 with stripped-down instrumentation for dynamic contrast',
    confidence: 87,
    actionable: false
  },
  {
    id: '3',
    type: 'sound-design',
    title: 'Layer Sub Bass',
    description: 'Add a sub bass layer at 40-60Hz to enhance low-end presence in R&B style',
    confidence: 95,
    actionable: true
  },
  {
    id: '4',
    type: 'mastering',
    title: 'Gentle Compression',
    description: 'Apply 2:1 ratio compression with slow attack for cohesive glue',
    confidence: 89,
    actionable: true
  }
];

export const ProductionAssistant: React.FC = () => {
  const [suggestions] = useState<ProductionSuggestion[]>(SAMPLE_SUGGESTIONS);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [analysisMode, setAnalysisMode] = useState<'smart' | 'detailed' | 'creative'>('smart');

  const filteredSuggestions = suggestions.filter(
    suggestion => selectedType === 'all' || suggestion.type === selectedType
  );

  const getTypeColor = (type: string) => {
    const colors = {
      'mixing': 'bg-neon-blue/20 text-neon-blue',
      'arrangement': 'bg-neon-purple/20 text-neon-purple',
      'sound-design': 'bg-neon-green/20 text-neon-green',
      'mastering': 'bg-neon-orange/20 text-neon-orange'
    };
    return colors[type as keyof typeof colors] || 'bg-studio-surface-secondary text-studio-text-secondary';
  };

  const getTypeIcon = (type: string) => {
    const icons = {
      'mixing': Volume2,
      'arrangement': Layers,
      'sound-design': Zap,
      'mastering': Target
    };
    const Icon = icons[type as keyof typeof icons] || Music;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-neon-purple" />
          Production Assistant
          <Badge variant="outline" className="ml-auto">
            <Sparkles className="w-3 h-3 mr-1" />
            AI Powered
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="suggestions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="reference">Reference</TabsTrigger>
          </TabsList>
          
          <TabsContent value="suggestions" className="space-y-4">
            {/* Filter Controls */}
            <div className="flex gap-2">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="mixing">Mixing</SelectItem>
                  <SelectItem value="arrangement">Arrangement</SelectItem>
                  <SelectItem value="sound-design">Sound Design</SelectItem>
                  <SelectItem value="mastering">Mastering</SelectItem>
                </SelectContent>
              </Select>
              
              <Button variant="outline" size="sm">
                <TrendingUp className="w-4 h-4 mr-1" />
                Analyze Track
              </Button>
            </div>

            {/* Suggestions List */}
            <div className="space-y-3">
              {filteredSuggestions.map(suggestion => (
                <Card key={suggestion.id} className="glass-card-subtle">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(suggestion.type)}
                        <h4 className="font-medium">{suggestion.title}</h4>
                        <Badge className={`text-xs ${getTypeColor(suggestion.type)}`}>
                          {suggestion.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-studio-text-secondary">
                          {suggestion.confidence}% match
                        </span>
                        {suggestion.actionable && (
                          <Button variant="outline" size="sm">
                            Apply
                          </Button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-studio-text-secondary">
                      {suggestion.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="analysis" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label>Analysis Mode</Label>
                <Select value={analysisMode} onValueChange={(value: any) => setAnalysisMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="smart">Smart Analysis</SelectItem>
                    <SelectItem value="detailed">Detailed Breakdown</SelectItem>
                    <SelectItem value="creative">Creative Suggestions</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Analysis Results */}
              <div className="grid grid-cols-2 gap-4">
                <Card className="glass-card-subtle">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-neon-blue" />
                      <span className="font-medium">Frequency Balance</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Low End</span>
                        <span className="text-neon-green">Good</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Mids</span>
                        <span className="text-neon-orange">Crowded</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>High End</span>
                        <span className="text-neon-blue">Bright</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="glass-card-subtle">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 className="w-4 h-4 text-neon-purple" />
                      <span className="font-medium">Dynamics</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>LUFS</span>
                        <span>-12.3</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Peak</span>
                        <span>-2.1 dB</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Range</span>
                        <span>8.7 LU</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="reference" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-neon-green" />
                <span className="font-medium">Reference Tracks</span>
                <Button variant="outline" size="sm" className="ml-auto">
                  Add Reference
                </Button>
              </div>

              <Card className="glass-card-subtle">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <Music className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <h4 className="font-medium">The Weeknd - Blinding Lights</h4>
                      <p className="text-sm text-studio-text-secondary">Reference for 80s-inspired production</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <Label>Similarity</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-studio-surface-secondary rounded-full h-2">
                          <div className="bg-neon-blue h-2 rounded-full" style={{ width: '76%' }}></div>
                        </div>
                        <span className="text-neon-blue">76%</span>
                      </div>
                    </div>
                    <div>
                      <Label>Loudness Match</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-studio-surface-secondary rounded-full h-2">
                          <div className="bg-neon-green h-2 rounded-full" style={{ width: '92%' }}></div>
                        </div>
                        <span className="text-neon-green">92%</span>
                      </div>
                    </div>
                    <div>
                      <Label>Freq Balance</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-studio-surface-secondary rounded-full h-2">
                          <div className="bg-neon-orange h-2 rounded-full" style={{ width: '68%' }}></div>
                        </div>
                        <span className="text-neon-orange">68%</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};