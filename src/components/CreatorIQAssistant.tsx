import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { 
  Sparkles, Send, Settings, Loader2, Instagram, Youtube, Music2, Check, X, Users, Paperclip, FileText
} from 'lucide-react';
import { documents } from '../data/documents';

// --- Simple Markdown Parser (Dependency-Free) ---
function SimpleMarkdown({ text }: { text: string }) {
  const formattedHtml = text
    // Bold
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-blue-600 hover:underline">$1</a>');

  return (
    <div 
      className="whitespace-pre-wrap" 
      dangerouslySetInnerHTML={{ __html: formattedHtml }} 
    />
  );
}

// --- Types ---
export type Creator = {
  id: string;
  handle: string;
  platform: 'Instagram' | 'TikTok' | 'YouTube';
  niche: string;
  followers: string;
  status: 'Pending Review' | 'Approved' | 'Rejected';
};

export interface CreatorIQAssistantProps {
  apiKey?: string;
  className?: string;
}

// --- Gemini Setup ---
const discoverCreatorsDeclaration: FunctionDeclaration = {
  name: "discoverCreators",
  description: "Discover new creators based on a specific niche and platform, and add them to the review list.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      niche: { type: Type.STRING, description: "The niche or category of the creators (e.g., 'beauty', 'gaming', 'tech')." },
      platform: { type: Type.STRING, description: "The platform to search on ('Instagram', 'TikTok', 'YouTube', or 'Any')." },
      count: { type: Type.NUMBER, description: "Number of creators to discover (default 3, max 100)." }
    },
    required: ["niche"]
  }
};

const searchExistingCRMDeclaration: FunctionDeclaration = {
  name: "searchExistingCRM",
  description: "Search or filter creators that already exist within the user's CRM. Use this when the user asks to find existing creators for a campaign.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      campaignOrQuery: { type: Type.STRING, description: "The search query, event, or campaign name (e.g., 'Black Friday')." }
    }
  }
};

const readCompanyDocumentDeclaration: FunctionDeclaration = {
  name: "readCompanyDocument",
  description: "Read a company document to incorporate brand guidelines or best practices into your work.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      documentName: { 
        type: Type.STRING, 
        description: "The name of the document to read.",
        enum: ["brand_guidelines", "best_practices"]
      }
    },
    required: ["documentName"]
  }
};

const addCreatorsToListDeclaration: FunctionDeclaration = {
  name: "addCreatorsToList",
  description: "Add creators to a curated List (shortlist/pipeline).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      listName: { type: Type.STRING, description: "Name of the list (e.g., 'Spring Launch - Shortlist')." },
      creatorHandles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of creator handles to add." }
    },
    required: ["listName", "creatorHandles"]
  }
};

const generateOneSheetDeclaration: FunctionDeclaration = {
  name: "generateOneSheet",
  description: "Generate a One-Sheet (client-ready or internal decision doc) from a List.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      listName: { type: Type.STRING, description: "Name of the list to generate the one-sheet from." }
    },
    required: ["listName"]
  }
};

const addCreatorsToCampaignDeclaration: FunctionDeclaration = {
  name: "addCreatorsToCampaign",
  description: "Add creators to a Campaign for activation and execution.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      campaignName: { type: Type.STRING, description: "Name of the campaign." },
      creatorHandles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Array of creator handles to add." }
    },
    required: ["campaignName", "creatorHandles"]
  }
};

const sendCreatorBriefDeclaration: FunctionDeclaration = {
  name: "sendCreatorBrief",
  description: "Brief creators on requirements (what they must do).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      campaignName: { type: Type.STRING, description: "Name of the campaign." },
      requirements: { type: Type.STRING, description: "Deliverables and instructions." }
    },
    required: ["campaignName", "requirements"]
  }
};

const setCreatorPayoutsDeclaration: FunctionDeclaration = {
  name: "setCreatorPayouts",
  description: "Set payouts (how creators will be paid, e.g., affiliate commission or fixed fee).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      campaignName: { type: Type.STRING, description: "Name of the campaign." },
      payoutDetails: { type: Type.STRING, description: "Details of the payout structure." }
    },
    required: ["campaignName", "payoutDetails"]
  }
};

const reviewCreatorContentDeclaration: FunctionDeclaration = {
  name: "reviewCreatorContent",
  description: "Review and approve creator content (deliverables).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      creatorHandle: { type: Type.STRING, description: "The creator's handle." },
      status: { type: Type.STRING, description: "Status to set ('Approved' or 'Rejected').", enum: ["Approved", "Rejected"] }
    },
    required: ["creatorHandle", "status"]
  }
};

const approvePaymentsDeclaration: FunctionDeclaration = {
  name: "approvePayments",
  description: "Approve payments (turn work into Payables, then Payouts).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      campaignName: { type: Type.STRING, description: "Name of the campaign." }
    },
    required: ["campaignName"]
  }
};

const getCampaignReportDeclaration: FunctionDeclaration = {
  name: "getCampaignReport",
  description: "Measure content + campaign performance (reporting).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      campaignName: { type: Type.STRING, description: "Name of the campaign." }
    },
    required: ["campaignName"]
  }
};

// --- Main Assistant Component ---
export function CreatorIQAssistant({ apiKey, className = '' }: CreatorIQAssistantProps) {
  const [messages, setMessages] = useState<any[]>([
    { role: 'model', parts: [{ text: 'Hello! I am your CreatorIQ AI assistant. I can help you discover new creators or search your CRM. What would you like to do?' }] }
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string, fileData?: { data: string, mimeType: string, name: string }) => {
    setIsLoading(true);
    
    const parts: any[] = [];
    if (fileData) {
      parts.push({
        inlineData: {
          data: fileData.data,
          mimeType: fileData.mimeType
        }
      });
    }
    if (text.trim()) {
      parts.push({ text });
    }

    const newUserMsg = { role: 'user', parts, attachmentName: fileData?.name };
    const newHistory = [...messages, newUserMsg];
    setMessages(newHistory);

    try {
      const activeKey = apiKey || process.env.GEMINI_API_KEY;
      if (!activeKey) {
        throw new Error("API key is missing. Please configure your Gemini API key.");
      }
      const ai = new GoogleGenAI({ apiKey: activeKey });

      let currentHistory = [...newHistory];
      
      // The Gemini API requires the history to start with a user message.
      // We slice off the initial greeting from the model and filter out UI widgets.
      let apiHistory = currentHistory.filter(m => m.role === 'user' || m.role === 'model').slice(1);
      
      const systemInstruction = "You are an AI assistant embedded in CreatorIQ, a platform for creator marketing. You help users manage the entire creator lifecycle: discovering creators, adding them to lists, generating one-sheets, adding to campaigns, briefing, setting payouts, reviewing content, approving payments, and pulling performance reports. Be professional, concise, and helpful. When a user asks to discover new creators, use the discoverCreators tool. If a user asks to search, filter, or recommend creators ALREADY EXISTING in their CRM (e.g., for a campaign), use the searchExistingCRM tool. When it returns an unsupported message, you MUST reply to the user with that EXACT message word-for-word. CRITICAL: If the user asks you to draft a brief, write a message, or create content, you MUST use the `readCompanyDocument` tool to read the 'brand_guidelines' and 'best_practices' documents first, and strictly incorporate their rules into your output.";
      const tools = [{ functionDeclarations: [
        discoverCreatorsDeclaration, searchExistingCRMDeclaration, readCompanyDocumentDeclaration,
        addCreatorsToListDeclaration, generateOneSheetDeclaration, addCreatorsToCampaignDeclaration,
        sendCreatorBriefDeclaration, setCreatorPayoutsDeclaration, reviewCreatorContentDeclaration,
        approvePaymentsDeclaration, getCampaignReportDeclaration
      ] }];

      let response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: apiHistory,
        config: { systemInstruction, tools }
      });

      let responseMsg = { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] };
      currentHistory.push(responseMsg);
      apiHistory.push(responseMsg);
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionResponses: any[] = [];
        let newlyDiscoveredCreators: Creator[] = [];
        
        for (const call of response.functionCalls) {
          let result;
          if (call.name === 'discoverCreators') {
            const args = call.args as any;
            const count = args.count || 3;
            const platformChoices = args.platform && args.platform !== 'Any' ? [args.platform] : ['Instagram', 'TikTok', 'YouTube'];
            
            for(let i=0; i<count; i++) {
              const p = platformChoices[Math.floor(Math.random() * platformChoices.length)];
              newlyDiscoveredCreators.push({
                id: 'c' + Math.random().toString(36).substring(2, 6),
                handle: `@${args.niche.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).substring(2, 5)}`,
                platform: p as any,
                niche: args.niche,
                followers: Math.floor(Math.random() * 900 + 100) + 'K',
                status: 'Pending Review'
              });
            }
            result = { status: 'success', discoveredCount: count, creators: newlyDiscoveredCreators };
          } else if (call.name === 'searchExistingCRM') {
            const args = call.args as any;
            const eventName = args.campaignOrQuery || 'Black Friday';
            result = { 
              status: 'unsupported', 
              message: `I currently don't have the ability to directly access or filter creators already existing within your CRM to make specific recommendations for your ${eventName} event.\n\nHowever, I can help you discover up to 5 **new** creators to add to your review list. If you'd like to do that, please let me know the specific niche (e.g., tech, beauty, fashion) and the platform (e.g., Instagram, TikTok, YouTube) you are targeting!` 
            };
          } else if (call.name === 'readCompanyDocument') {
            const args = call.args as any;
            const docContent = documents[args.documentName];
            if (docContent) {
              result = { status: 'success', content: docContent };
            } else {
              result = { status: 'error', message: 'Document not found.' };
            }
          } else if (call.name === 'addCreatorsToList') {
            const args = call.args as any;
            result = { status: 'success', message: `Successfully added ${args.creatorHandles?.length || 0} creators to the list "${args.listName}".` };
          } else if (call.name === 'generateOneSheet') {
            const args = call.args as any;
            result = { status: 'success', message: `One-Sheet generated for list "${args.listName}".`, link: `https://creatoriq.app/onesheet/${Math.random().toString(36).substring(2, 8)}` };
          } else if (call.name === 'addCreatorsToCampaign') {
            const args = call.args as any;
            result = { status: 'success', message: `Successfully added ${args.creatorHandles?.length || 0} creators to the campaign "${args.campaignName}".` };
          } else if (call.name === 'sendCreatorBrief') {
            const args = call.args as any;
            result = { status: 'success', message: `Brief successfully sent to creators in campaign "${args.campaignName}".` };
          } else if (call.name === 'setCreatorPayouts') {
            const args = call.args as any;
            result = { status: 'success', message: `Payouts configured for campaign "${args.campaignName}".` };
          } else if (call.name === 'reviewCreatorContent') {
            const args = call.args as any;
            result = { status: 'success', message: `Content for ${args.creatorHandle} has been ${args.status.toLowerCase()}.` };
          } else if (call.name === 'approvePayments') {
            const args = call.args as any;
            result = { status: 'success', message: `Payments approved for campaign "${args.campaignName}". Payables are now processing.` };
          } else if (call.name === 'getCampaignReport') {
            const args = call.args as any;
            result = { 
              status: 'success', 
              data: { 
                campaign: args.campaignName,
                postsPublished: Math.floor(Math.random() * 50) + 10,
                impressions: (Math.random() * 5 + 1).toFixed(1) + 'M', 
                engagements: Math.floor(Math.random() * 100) + 20 + 'K', 
                clicks: Math.floor(Math.random() * 20) + 5 + 'K', 
                sales: '$' + (Math.random() * 50 + 10).toFixed(1) + 'K' 
              } 
            };
          }
          
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: result
            }
          });
        }
        
        const funcRespMsg = { role: 'user', parts: functionResponses };
        currentHistory.push(funcRespMsg);
        apiHistory.push(funcRespMsg);

        if (newlyDiscoveredCreators.length > 0) {
          currentHistory.push({ role: 'widget', widgetType: 'creatorList', creators: newlyDiscoveredCreators });
        }
        
        // Call again with function response
        response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: apiHistory,
          config: { systemInstruction, tools }
        });
        
        responseMsg = { role: 'model', parts: response.candidates?.[0]?.content?.parts || [] };
        currentHistory.push(responseMsg);
      }
      
      setMessages([...currentHistory]);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message?.includes("API key is missing") 
        ? "API key is missing. Please configure your Gemini API key in the settings."
        : "Sorry, I encountered an error processing your request.";
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: errorMessage }] }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateCreatorStatus = (messageIndex: number, creatorId: string, status: Creator['status']) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const msg = newMessages[messageIndex];
      if (msg && msg.role === 'widget' && msg.creators) {
        msg.creators = msg.creators.map((c: Creator) => c.id === creatorId ? { ...c, status } : c);
      }
      return newMessages;
    });
  };

  return (
    <div className={`flex flex-col h-full bg-white text-slate-900 font-sans ${className}`}>
      <main className="flex-1 overflow-auto p-6 flex flex-col items-center bg-slate-50/50">
        <div className="w-full max-w-4xl space-y-6 pb-4">
          {messages.map((msg, i) => (
            <ChatMessage 
              key={i} 
              message={msg} 
              onUpdateCreatorStatus={(id, status) => handleUpdateCreatorStatus(i, id, status)} 
            />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-slate-500">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="text-sm font-medium">Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>
      
      <footer className="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-center shadow-[0_-4px_20px_rgba(0,0,0,0.02)] z-10">
        <div className="w-full max-w-4xl">
          <ChatInput onSend={sendMessage} disabled={isLoading} />
        </div>
      </footer>
    </div>
  );
}

// --- Subcomponents ---

function CreatorList({ creators, onUpdateStatus }: { creators: Creator[], onUpdateStatus: (id: string, status: Creator['status']) => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm my-2">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
        <Users size={16} className="text-slate-500" />
        <span className="font-semibold text-slate-700 text-sm">Discovered Creators</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-white border-b border-slate-100 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Creator</th>
              <th className="px-4 py-3 font-medium">Platform</th>
              <th className="px-4 py-3 font-medium">Niche</th>
              <th className="px-4 py-3 font-medium">Followers</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {creators.map(creator => (
              <tr key={creator.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{creator.handle}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    {creator.platform === 'Instagram' && <Instagram size={14} className="text-pink-600" />}
                    {creator.platform === 'TikTok' && <Music2 size={14} className="text-black" />}
                    {creator.platform === 'YouTube' && <Youtube size={14} className="text-red-600" />}
                    {creator.platform}
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 capitalize">{creator.niche}</td>
                <td className="px-4 py-3 text-slate-600 font-medium">{creator.followers}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide ${
                    creator.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                    creator.status === 'Rejected' ? 'bg-red-100 text-red-700 border border-red-200' :
                    'bg-amber-100 text-amber-700 border border-amber-200'
                  }`}>
                    {creator.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  {creator.status === 'Pending Review' && (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onUpdateStatus(creator.id, 'Approved')} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Approve">
                        <Check size={16} />
                      </button>
                      <button onClick={() => onUpdateStatus(creator.id, 'Rejected')} className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Reject">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChatMessage({ message, onUpdateCreatorStatus }: { message: any, onUpdateCreatorStatus: (id: string, status: Creator['status']) => void }) {
  if (message.role === 'widget' && message.widgetType === 'creatorList') {
    return (
      <div className="flex justify-start w-full">
        <div className="w-full max-w-3xl">
          <CreatorList creators={message.creators} onUpdateStatus={onUpdateCreatorStatus} />
        </div>
      </div>
    );
  }

  const textParts = message.parts?.filter((p: any) => p.text) || [];
  const functionCallParts = message.parts?.filter((p: any) => p.functionCall) || [];
  
  if (textParts.length === 0 && functionCallParts.length > 0) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm">
          <Settings size={12} className="animate-spin text-blue-600" />
          Executing action...
        </span>
      </div>
    );
  }

  if (textParts.length === 0) return null;

  const isModel = message.role === 'model';
  
  return (
    <div className={`flex ${isModel ? 'justify-start' : 'justify-end'} w-full`}>
      <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${isModel ? 'bg-white text-slate-800 rounded-tl-sm border border-slate-200' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
        {message.attachmentName && (
          <div className="flex items-center gap-2 bg-blue-700/50 text-blue-50 px-3 py-2 rounded-lg mb-2 text-sm">
            <FileText size={16} />
            <span className="truncate font-medium">{message.attachmentName}</span>
          </div>
        )}
        {textParts.map((p: any, i: number) => (
          <div key={i} className={`text-[15px] leading-relaxed ${isModel ? 'prose prose-slate prose-sm max-w-none' : 'whitespace-pre-wrap'}`}>
            {isModel ? <SimpleMarkdown text={p.text} /> : p.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatInput({ onSend, disabled }: { onSend: (text: string, file?: { data: string, mimeType: string, name: string }) => void, disabled: boolean }) {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleSend = () => {
    if ((text.trim() || selectedFile) && !disabled) {
      if (selectedFile) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(',')[1];
          onSend(text.trim(), { data: base64String, mimeType: selectedFile.type, name: selectedFile.name });
          setText('');
          setSelectedFile(null);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        onSend(text.trim());
        setText('');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {selectedFile && (
        <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">
          <div className="flex items-center gap-2 overflow-hidden">
            <FileText size={16} className="text-blue-600 shrink-0" />
            <span className="truncate font-medium">{selectedFile.name}</span>
          </div>
          <button 
            onClick={() => setSelectedFile(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="relative flex items-end gap-2">
        <div className="relative w-full">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask AI to discover creators or attach a brief..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-14 py-3.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 resize-none min-h-[54px] max-h-[150px] shadow-inner"
            disabled={disabled}
            rows={1}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="absolute left-3 bottom-3 text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50"
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            className="hidden" 
            accept=".pdf,.txt,.csv,.doc,.docx,image/*"
          />
        </div>
        <button 
          onClick={handleSend}
          disabled={disabled || (!text.trim() && !selectedFile)}
          className="h-[54px] w-[54px] shrink-0 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
        >
          <Send size={20} className="ml-0.5" />
        </button>
      </div>
    </div>
  );
}
