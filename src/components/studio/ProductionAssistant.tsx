import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { AudioAnalysis } from '@/lib/audioAnalyzer';
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
  Headphones,
  Mic,
  Guitar,
  Drum,
  Piano,
  Wand2
} from 'lucide-react';

interface ProductionSuggestion {
  id: string;
  type: 'mixing' | 'arrangement' | 'sound-design' | 'mastering' | 'instrumentation' | 'creative';
  title: string;
  description: string;
  confidence: number;
  actionable: boolean;
  reasoning?: string;
  instrument?: string;
}

interface ProductionAssistantProps {
  audioAnalysis?: AudioAnalysis;
  currentTrack?: any;
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

// AI Analysis Engine - Lando's Brain
const generateIntelligentSuggestions = (analysis: AudioAnalysis): ProductionSuggestion[] => {
  const suggestions: ProductionSuggestion[] = [];
  
  // Tempo-based suggestions
  if (analysis.tempo < 80) {
    suggestions.push({
      id: `tempo-${Date.now()}`,
      type: 'arrangement',
      title: 'Add Rhythmic Drive Elements',
      description: `At ${analysis.tempo} BPM, consider adding shakers, hi-hats, or percussion loops to create more rhythmic momentum`,
      confidence: 88,
      actionable: true,
      reasoning: 'Slow tempo tracks benefit from additional rhythmic elements'
    });
  } else if (analysis.tempo > 140) {
    suggestions.push({
      id: `tempo-${Date.now()}`,
      type: 'mixing',
      title: 'Apply Side-Chain Compression',
      description: `High-energy ${analysis.tempo} BPM track would benefit from side-chain compression to create pumping effect`,
      confidence: 92,
      actionable: true,
      reasoning: 'Fast tempo tracks work well with dynamic compression'
    });
  }

  // Key and Mode suggestions
  if (analysis.mode === 'minor') {
    suggestions.push({
      id: `key-${Date.now()}`,
      type: 'instrumentation',
      title: 'Layer Emotional Strings',
      description: `The ${analysis.key} minor key creates perfect foundation for lush string arrangements or pad textures`,
      confidence: 90,
      actionable: true,
      reasoning: 'Minor keys naturally support emotional string arrangements',
      instrument: 'strings'
    });
  } else {
    suggestions.push({
      id: `key-${Date.now()}`,
      type: 'instrumentation',
      title: 'Add Bright Lead Elements',
      description: `${analysis.key} major key is ideal for bright lead synths, guitars, or brass sections`,
      confidence: 85,
      actionable: true,
      reasoning: 'Major keys support uplifting melodic elements',
      instrument: 'lead'
    });
  }

  // Energy-based suggestions
  if (analysis.energy < 0.4) {
    suggestions.push({
      id: `energy-${Date.now()}`,
      type: 'sound-design',
      title: 'Enhance Dynamic Range',
      description: 'Low energy detected - consider adding subtle risers, sweeps, or dynamic automation to build excitement',
      confidence: 87,
      actionable: true,
      reasoning: 'Low energy tracks need movement and dynamics'
    });
  } else if (analysis.energy > 0.8) {
    suggestions.push({
      id: `energy-${Date.now()}`,
      type: 'arrangement',
      title: 'Create Breathing Space',
      description: 'High energy throughout - consider adding breakdown sections or filter sweeps for dynamic contrast',
      confidence: 89,
      actionable: true,
      reasoning: 'High energy tracks need moments of release'
    });
  }

  // Danceability suggestions
  if (analysis.danceability > 0.7) {
    suggestions.push({
      id: `dance-${Date.now()}`,
      type: 'instrumentation',
      title: 'Layer Sub Bass Foundation',
      description: 'High danceability detected - a solid sub bass layer (40-80Hz) will enhance the groove',
      confidence: 94,
      actionable: true,
      reasoning: 'Danceable tracks need strong low-end foundation',
      instrument: 'bass'
    });
  }

  // Spectral suggestions
  if (analysis.spectralFeatures.centroid > 2000) {
    suggestions.push({
      id: `spectral-${Date.now()}`,
      type: 'mixing',
      title: 'Warm Up the Low-Mids',
      description: 'Bright spectral content detected - consider adding warmth in 200-500Hz range for balance',
      confidence: 86,
      actionable: true,
      reasoning: 'Bright tracks often need low-mid warmth for fullness'
    });
  }

  // Harmonic content suggestions
  const harmonicRichness = analysis.harmonicContent.reduce((a, b) => a + b, 0) / analysis.harmonicContent.length;
  if (harmonicRichness < 0.3) {
    suggestions.push({
      id: `harmonic-${Date.now()}`,
      type: 'sound-design',
      title: 'Add Harmonic Saturation',
      description: 'Limited harmonic content - tape saturation or tube warmth could add richness and character',
      confidence: 83,
      actionable: true,
      reasoning: 'Low harmonic content benefits from saturation processing'
    });
  }

  // Creative arrangement suggestions based on rhythm pattern
  const rhythmVariation = Math.max(...analysis.rhythmPattern) - Math.min(...analysis.rhythmPattern);
  if (rhythmVariation < 0.2) {
    suggestions.push({
      id: `rhythm-${Date.now()}`,
      type: 'creative',
      title: 'Introduce Rhythmic Variations',
      description: 'Steady rhythm detected - consider adding ghost notes, swing, or syncopated elements for interest',
      confidence: 81,
      actionable: true,
      reasoning: 'Consistent rhythms benefit from subtle variations'
    });
  }

  return suggestions;
};

export const ProductionAssistant: React.FC<ProductionAssistantProps> = ({ 
  audioAnalysis, 
  currentTrack 
}) => {
  const [suggestions, setSuggestions] = useState<ProductionSuggestion[]>(SAMPLE_SUGGESTIONS);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [analysisMode, setAnalysisMode] = useState<'smart' | 'detailed' | 'creative'>('smart');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Generate intelligent suggestions when audio analysis is available
  useEffect(() => {
    if (audioAnalysis) {
      setIsAnalyzing(true);
      
      // Simulate Lando thinking (adds realism to AI processing)
      setTimeout(() => {
        const intelligentSuggestions = generateIntelligentSuggestions(audioAnalysis);
        setSuggestions([...intelligentSuggestions, ...SAMPLE_SUGGESTIONS]);
        setIsAnalyzing(false);
      }, 1500);
    }
  }, [audioAnalysis]);

  const filteredSuggestions = suggestions.filter(
    suggestion => selectedType === 'all' || suggestion.type === selectedType
  );

  const getTypeColor = (type: string) => {
    const colors = {
      'mixing': 'bg-neon-blue/20 text-neon-blue',
      'arrangement': 'bg-neon-purple/20 text-neon-purple',
      'sound-design': 'bg-neon-green/20 text-neon-green',
      'mastering': 'bg-neon-orange/20 text-neon-orange',
      'instrumentation': 'bg-pink-500/20 text-pink-400',
      'creative': 'bg-yellow-500/20 text-yellow-400'
    };
    return colors[type as keyof typeof colors] || 'bg-studio-surface-secondary text-studio-text-secondary';
  };

  const getTypeIcon = (type: string, instrument?: string) => {
    const icons = {
      'mixing': Volume2,
      'arrangement': Layers,
      'sound-design': Zap,
      'mastering': Target,
      'instrumentation': instrument === 'strings' ? Piano : 
                        instrument === 'bass' ? Guitar :
                        instrument === 'lead' ? Guitar : Mic,
      'creative': Wand2
    };
    const Icon = icons[type as keyof typeof icons] || Music;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-neon-purple" />
          Lando - AI Production Assistant
          <Badge variant="outline" className="ml-auto">
            <Sparkles className="w-3 h-3 mr-1" />
            {isAnalyzing ? 'Analyzing...' : audioAnalysis ? 'AI Enhanced' : 'AI Powered'}
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
            {/* AI Status & Filter Controls */}
            <div className="space-y-4">
              {audioAnalysis && (
                <Card className="glass-card-subtle border-neon-purple/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <Brain className="w-4 h-4 text-neon-purple animate-pulse" />
                      <span className="font-medium">Lando analyzed your track:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {audioAnalysis.tempo} BPM
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {audioAnalysis.key} {audioAnalysis.mode}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(audioAnalysis.energy * 100)}% Energy
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {Math.round(audioAnalysis.danceability * 100)}% Danceability
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              <div className="flex flex-wrap gap-3">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent className="bg-studio-surface border border-studio-border">
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="mixing">Mixing</SelectItem>
                    <SelectItem value="arrangement">Arrangement</SelectItem>
                    <SelectItem value="sound-design">Sound Design</SelectItem>
                    <SelectItem value="mastering">Mastering</SelectItem>
                    <SelectItem value="instrumentation">Instrumentation</SelectItem>
                    <SelectItem value="creative">Creative</SelectItem>
                  </SelectContent>
                </Select>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={isAnalyzing}
                  className="whitespace-nowrap"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  {isAnalyzing ? 'Analyzing...' : 'Re-analyze'}
                </Button>
              </div>
            </div>

            {/* Suggestions List */}
            <div className="space-y-3">
              {filteredSuggestions.map(suggestion => (
                <Card key={suggestion.id} className="glass-card-subtle">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          {getTypeIcon(suggestion.type, suggestion.instrument)}
                        </div>
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-medium text-base">{suggestion.title}</h4>
                            <Badge className={`text-xs ${getTypeColor(suggestion.type)}`}>
                              {suggestion.type}
                            </Badge>
                            {suggestion.instrument && (
                              <Badge variant="outline" className="text-xs">
                                {suggestion.instrument}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-sm text-studio-text-secondary whitespace-nowrap">
                          {suggestion.confidence}% match
                        </span>
                        {suggestion.actionable && (
                          <Button variant="outline" size="sm" className="whitespace-nowrap">
                            Apply
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="pl-7 space-y-3">
                      <p className="text-sm text-studio-text-secondary leading-relaxed">
                        {suggestion.description}
                      </p>
                      {suggestion.reasoning && (
                        <div className="flex items-start gap-3 p-3 bg-studio-surface-secondary/30 rounded-lg">
                          <Brain className="w-4 h-4 text-neon-purple mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-medium text-neon-purple mb-1">Lando's Insight:</p>
                            <p className="text-xs text-studio-text-secondary italic leading-relaxed">
                              {suggestion.reasoning}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
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
              {audioAnalysis ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="glass-card-subtle">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <BarChart3 className="w-4 h-4 text-neon-blue" />
                          <span className="font-medium">Musical Analysis</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Tempo</span>
                            <span className="text-neon-blue">{audioAnalysis.tempo} BPM</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Key</span>
                            <span className="text-neon-green">{audioAnalysis.key} {audioAnalysis.mode}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Energy</span>
                            <span className="text-neon-orange">{Math.round(audioAnalysis.energy * 100)}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Danceability</span>
                            <span className="text-neon-purple">{Math.round(audioAnalysis.danceability * 100)}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="glass-card-subtle">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Volume2 className="w-4 h-4 text-neon-purple" />
                          <span className="font-medium">Spectral Features</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Centroid</span>
                            <span>{Math.round(audioAnalysis.spectralFeatures.centroid)} Hz</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Rolloff</span>
                            <span>{Math.round(audioAnalysis.spectralFeatures.rolloff)} Hz</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Zero Crossings</span>
                            <span>{audioAnalysis.spectralFeatures.zcr.toFixed(3)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Valence</span>
                            <span className="text-neon-green">{Math.round(audioAnalysis.valence * 100)}%</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <Card className="glass-card-subtle">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Wand2 className="w-4 h-4 text-neon-purple" />
                        <span className="font-medium">Lando's Professional Assessment</span>
                      </div>
                      <div className="text-sm text-studio-text-secondary space-y-2">
                        <p>
                          "This track has a {audioAnalysis.valence > 0.5 ? 'positive, uplifting' : 'moody, introspective'} feel 
                          with {audioAnalysis.energy > 0.7 ? 'high energy' : audioAnalysis.energy > 0.4 ? 'moderate energy' : 'low energy'} characteristics. 
                          The {audioAnalysis.key} {audioAnalysis.mode} tonality at {audioAnalysis.tempo} BPM suggests 
                          {audioAnalysis.danceability > 0.6 ? 'strong dancefloor potential' : 'more experimental or cinematic applications'}."
                        </p>
                        <p className="italic text-neon-purple">
                          - Lando's recommendation: Focus on {audioAnalysis.energy < 0.5 ? 'building dynamic contrast' : 'maintaining the energy while adding depth'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="text-center py-8 text-studio-text-secondary">
                  <Brain className="w-12 h-12 mx-auto mb-3 text-studio-text-secondary/50" />
                  <p>Upload an audio file to enable Lando's advanced analysis</p>
                </div>
              )}
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