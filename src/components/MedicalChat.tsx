import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Stethoscope, AlertTriangle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import medicalIcon from "@/assets/medical-icon.png";

interface Message {
  id: string;
  content: string;
  type: 'user' | 'assistant';
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'emergency';
}

interface ApiKeyModalProps {
  onApiKeySubmit: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onApiKeySubmit }) => {
  const [apiKey, setApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (apiKey.trim()) {
      onApiKeySubmit(apiKey.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="p-6 w-full max-w-md mx-4 bg-card shadow-medical">
        <div className="flex items-center gap-3 mb-4">
          <Stethoscope className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-semibold">Setup Required</h2>
        </div>
        <p className="text-muted-foreground mb-4">
          Please enter your Google Gemini API key to enable Mr.Doctor's AI functionality.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Enter your Gemini API key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full"
          />
          <Button type="submit" variant="medical" className="w-full">
            Start Diagnosis
          </Button>
        </form>
      </Card>
    </div>
  );
};

export const MedicalChat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const existing = localStorage.getItem('gemini_api_key');
      if (existing) return existing;
      const preset = 'AIzaSyBrIwkRlLyVC8GqTOplzGKIAtZNgzTK3dc';
      localStorage.setItem('gemini_api_key', preset);
      return preset;
    }
    return null;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Welcome message
    if (apiKey && messages.length === 0) {
      const welcomeMessage: Message = {
        id: '1',
        content: "Hello! I'm Mr.Doctor, your AI medical assistant. I can help analyze your symptoms and provide health guidance. Please describe your symptoms in detail, but remember that I'm not a replacement for professional medical care. How can I help you today?",
        type: 'assistant',
        timestamp: new Date(),
        severity: 'low'
      };
      setMessages([welcomeMessage]);
    }
  }, [apiKey]);

  const callGeminiAPI = async (userMessage: string): Promise<string> => {
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const medicalPrompt = `You are Mr.Doctor, a helpful AI medical assistant. Analyze the user's symptoms and provide:
1. Possible conditions (with likelihood)
2. Recommended actions
3. When to seek immediate care
4. General health advice

Always include appropriate disclaimers about seeking professional medical care. Be helpful but responsible.

User's symptoms: ${userMessage}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: medicalPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.8,
          maxOutputTokens: 1000,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || 'I apologize, but I could not process your request. Please try again.';
  };

  const determineSeverity = (content: string): 'low' | 'medium' | 'high' | 'emergency' => {
    const emergencyKeywords = ['emergency', 'urgent', 'immediate', 'severe pain', 'difficulty breathing'];
    const highKeywords = ['serious', 'concerning', 'medical attention', 'doctor immediately'];
    const mediumKeywords = ['monitor', 'watch', 'see a doctor', 'concerning'];
    
    const lowerContent = content.toLowerCase();
    
    if (emergencyKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'emergency';
    }
    if (highKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'high';
    }
    if (mediumKeywords.some(keyword => lowerContent.includes(keyword))) {
      return 'medium';
    }
    return 'low';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      type: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await callGeminiAPI(userMessage.content);
      const severity = determineSeverity(response);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response,
        type: 'assistant',
        timestamp: new Date(),
        severity
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (severity === 'emergency') {
        toast({
          title: "⚠️ Emergency Alert",
          description: "Please seek immediate medical attention if experiencing severe symptoms.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error calling Gemini API:', error);
      toast({
        title: "Error",
        description: "Failed to get medical analysis. Please check your API key and try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityIcon = (severity?: string) => {
    switch (severity) {
      case 'emergency':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'medium':
        return <Info className="h-4 w-4 text-primary" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'emergency':
        return 'destructive';
      case 'high':
        return 'secondary';
      case 'medium':
        return 'default';
      default:
        return 'outline';
    }
  };

  if (!apiKey) {
    return (
      <ApiKeyModal
        onApiKeySubmit={(key) => {
          localStorage.setItem('gemini_api_key', key);
          setApiKey(key);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-trust">
      {/* Header */}
      <div className="border-b bg-card shadow-card p-4">
        <div className="flex items-center gap-3">
          <img src={medicalIcon} alt="Mr.Doctor" className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold text-primary">Mr.Doctor</h1>
            <p className="text-sm text-muted-foreground">AI Medical Assistant</p>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.type === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-card-foreground shadow-card'
              }`}
            >
              {message.type === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">Mr.Doctor</span>
                  {message.severity && (
                    <Badge variant={getSeverityColor(message.severity)} className="text-xs">
                      {getSeverityIcon(message.severity)}
                      {message.severity}
                    </Badge>
                  )}
                </div>
              )}
              <p className="whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-70 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-card text-card-foreground rounded-lg p-3 shadow-card">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm">Mr.Doctor is analyzing...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="border-t bg-card p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe your symptoms..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} variant="medical">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          ⚠️ This is not a substitute for professional medical advice, diagnosis, or treatment.
        </p>
      </div>
    </div>
  );
};