import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Headphones, Volume2, Check, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

interface AudioOutputSelectorProps {
  onDeviceChange?: (deviceId: string) => void;
}

export const AudioOutputSelector: React.FC<AudioOutputSelectorProps> = ({ onDeviceChange }) => {
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const { toast } = useToast();

  // Get available audio output devices
  const getAudioDevices = async () => {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(device => 
        device.kind === 'audiooutput' && device.deviceId !== 'communications'
      );
      
      setAudioDevices(audioOutputs);
      
      // Set default device
      const defaultDevice = audioOutputs.find(device => device.deviceId === 'default') || audioOutputs[0];
      if (defaultDevice) {
        setSelectedDevice(defaultDevice.deviceId);
      }
      
    } catch (error) {
      console.error('Error getting audio devices:', error);
      toast({
        title: "Device Access Error",
        description: "Could not access audio devices. Please allow microphone permission.",
        variant: "destructive"
      });
    }
  };

  // Connect to selected audio device
  const connectToDevice = async (deviceId: string) => {
    setIsConnecting(true);
    setConnectionStatus('connecting');
    
    try {
      // Find the device info
      const device = audioDevices.find(d => d.deviceId === deviceId);
      const deviceName = device?.label || 'Selected Device';
      
      
      // Test audio output to the selected device
      if ('setSinkId' in HTMLAudioElement.prototype) {
        const testAudio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmEaMFbIsNiTNVxcpJtVUWklAAAAAA==');
        
        // Set the audio output device
        await (testAudio as any).setSinkId(deviceId);
        testAudio.volume = 0.3;
        
        // Play test sound to confirm routing
        await testAudio.play();
        
        setSelectedDevice(deviceId);
        setConnectionStatus('connected');
        onDeviceChange?.(deviceId);
        
        toast({
          title: "🎧 AirPods Connected!",
          description: `Audio will now play through: ${deviceName}`,
        });
        
      } else {
        // Fallback for browsers that don't support setSinkId
        setSelectedDevice(deviceId);
        setConnectionStatus('connected');
        onDeviceChange?.(deviceId);
        
        toast({
          title: "AirPods Selected",
          description: `Selected: ${deviceName} (Using browser default routing)`,
        });
      }
      
    } catch (error) {
      console.error('❌ Error connecting to AirPods:', error);
      setConnectionStatus('error');
      
      toast({
        title: "Connection Failed",
        description: "Could not connect to AirPods. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    getAudioDevices();
    
    // Listen for device changes
    navigator.mediaDevices.addEventListener('devicechange', getAudioDevices);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', getAudioDevices);
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-neon-green';
      case 'connecting': return 'text-neon-blue';
      case 'error': return 'text-red-400';
      default: return 'text-studio-text-secondary';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Check className="w-4 h-4 text-neon-green" />;
      case 'connecting': return <Volume2 className="w-4 h-4 text-neon-blue animate-pulse" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
      default: return <Headphones className="w-4 h-4" />;
    }
  };

  return (
    <Card className="glass-card-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Headphones className="w-5 h-5 text-neon-blue" />
          Audio Output Device
          <Badge 
            variant="outline" 
            className={`ml-auto ${getStatusColor()}`}
          >
            {getStatusIcon()}
            {connectionStatus === 'connected' ? 'Connected' : 
             connectionStatus === 'connecting' ? 'Connecting...' : 
             connectionStatus === 'error' ? 'Error' : 'Select Device'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Choose Output Device:</label>
          <Select 
            value={selectedDevice} 
            onValueChange={(deviceId) => connectToDevice(deviceId)}
            disabled={isConnecting}
          >
            <SelectTrigger className="bg-studio-surface border border-studio-border">
              <SelectValue placeholder="Select audio output device..." />
            </SelectTrigger>
            <SelectContent className="bg-studio-surface border border-studio-border">
              {audioDevices.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  <div className="flex items-center gap-2">
                    {device.label.toLowerCase().includes('airpods') && '🎧'}
                    {device.label.toLowerCase().includes('bluetooth') && '📶'}
                    {device.deviceId === 'default' && '🔊'}
                    <span>{device.label || `Audio Device ${device.deviceId.slice(0, 8)}`}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={getAudioDevices}
            disabled={isConnecting}
          >
            🔄 Refresh Devices
          </Button>
          
          <Button 
            variant="neon" 
            size="sm"
            onClick={() => selectedDevice && connectToDevice(selectedDevice)}
            disabled={isConnecting || !selectedDevice}
          >
            {isConnecting ? 'Connecting...' : '🎧 Connect'}
          </Button>
        </div>

        {audioDevices.length === 0 && (
          <p className="text-xs text-studio-text-secondary">
            No audio devices found. Make sure your AirPods are connected and try refreshing.
          </p>
        )}
      </CardContent>
    </Card>
  );
};