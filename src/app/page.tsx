'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon, PaperAirplaneIcon, DocumentTextIcon } from '@heroicons/react/24/solid';
import confetti from 'canvas-confetti';
import { CohereClient } from 'cohere-ai';
import Image from 'next/image';
import documentRepository from './data/documentRepository';

const apiKey = process.env.NEXT_PUBLIC_COHERE_API_KEY;
if (!apiKey) {
  console.error('Cohere API key is missing! Please add it to your .env.local file.');
}

const cohere = new CohereClient({
  token: process.env.NEXT_PUBLIC_COHERE_API_KEY || '',
});

export default function Home() {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [documents, setDocuments] = useState<{ content: string; title: string }[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Load documents on component mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        console.log('Loading documents from:', documentRepository.map(doc => doc.path));
        
        const loadedDocs = await Promise.all(
          documentRepository.map(async (doc) => {
            try {
              const response = await fetch(doc.path);
              if (!response.ok) {
                console.error(`Failed to load document: ${doc.path} with status ${response.status}`);
                throw new Error(`Failed to load document: ${doc.path}`);
              }
              const content = await response.text();
              console.log(`Successfully loaded document: ${doc.title}`);
              return { content, title: doc.title };
            } catch (error) {
              console.error(`Error loading document ${doc.path}:`, error);
              return {
                content: `Unable to load ${doc.title}. Please check the document path.`,
                title: doc.title
              };
            }
          })
        );
        
        const validDocs = loadedDocs.filter(doc => !doc.content.startsWith('Unable to load'));
        console.log('Loaded Documents:', validDocs); // Debug log
        setDocuments(loadedDocs);
      } catch (error) {
        console.error('Error in document loading process:', error);
      }
    };
  
    loadDocuments();
  }, []);

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chat]);

  useEffect(() => {
    if (chat.length === 0) {
      const welcomeMessage = {
        role: 'assistant',
        content: 'Hello! I\'m Panoptis. How can I help you? I\'m happy to chat in your language and answer your questions about the app. 😊'
      };
      setChat([welcomeMessage]);
      triggerConfetti();
    }
  }, [chat.length]);

  // Function to find relevant document content based on user query
  const findRelevantDocuments = async (query: string) => {
    try {
      if (documents.length === 0) return null;
  
      const docTexts = documents.map(doc => doc.content);
      const response = await cohere.embed({
        texts: [...docTexts, query],
        model: 'embed-english-v3.0',
        inputType: 'search_query',
      });
  
      console.log('Embeddings Response:', response.embeddings); // Debug log
  
      const embeddings = response.embeddings as number[][];
      if (!embeddings || !Array.isArray(embeddings)) {
        console.error('No valid embeddings returned from Cohere');
        return null;
      }
  
      const queryEmbedding = embeddings[embeddings.length - 1];
      let mostSimilarIdx = -1;
      let highestSimilarity = -Infinity;
  
      for (let i = 0; i < documents.length; i++) {
        if (i < embeddings.length - 1) {
          const docEmbedding = embeddings[i];
          const similarity = calculateCosineSimilarity(queryEmbedding, docEmbedding);
          console.log(`Similarity with ${documents[i].title}: ${similarity}`); // Debug log
  
          if (similarity > highestSimilarity) {
            highestSimilarity = similarity;
            mostSimilarIdx = i;
          }
        }
      }
  
      if (mostSimilarIdx !== -1 && highestSimilarity > 0.05) {
        console.log(`Best match: ${documents[mostSimilarIdx]?.title} with similarity: ${highestSimilarity}`);
        return {
          content: documents[mostSimilarIdx].content,
          title: documents[mostSimilarIdx].title,
        };
      }
  
      console.log('No matching document found');
      return null;
    } catch (error) {
      console.error('Error finding relevant documents:', error);
      return null;
    }
  };

  // Helper function to calculate cosine similarity between two vectors
  const calculateCosineSimilarity = (vec1: number[], vec2: number[]) => {
    let dotProduct = 0;
    let vec1Mag = 0;
    let vec2Mag = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      vec1Mag += vec1[i] * vec1[i];
      vec2Mag += vec2[i] * vec2[i];
    }
    
    vec1Mag = Math.sqrt(vec1Mag);
    vec2Mag = Math.sqrt(vec2Mag);
    
    if (vec1Mag === 0 || vec2Mag === 0) return 0;
    return dotProduct / (vec1Mag * vec2Mag);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
  
    const newMessage = { role: 'user', content: message };
    setChat(prev => [...prev, newMessage]);
    setMessage('');
    setIsLoading(true);
  
    try {
      // Check for specific keywords in the query
      const lowerCaseMessage = message.toLowerCase();
      let forcedDocId = null;
  
      if (lowerCaseMessage.includes('elefantgotchi')) {
        forcedDocId = 'elefantgotchi';
        console.log('Detected elefantgotchi-related question, forcing elefantgotchi document');
      }
  
      if (
        lowerCaseMessage.includes('price') ||
        lowerCaseMessage.includes('cost') ||
        lowerCaseMessage.includes('subscription') ||
        lowerCaseMessage.includes('plan')
      ) {
        forcedDocId = 'pricing';
        console.log('Detected pricing-related question, forcing pricing document');
      }
  
      // First try to find relevant documents
      let relevantDoc = await findRelevantDocuments(message);
  
      // If we have a forced document ID, override the relevant document
      if (forcedDocId) {
        const forcedDocRepo = documentRepository.find(repo => repo.id === forcedDocId);
        const forcedDoc = documents.find(doc => doc.title === forcedDocRepo?.title);
  
        if (forcedDoc) {
          relevantDoc = forcedDoc; // Reassigning relevantDoc
          console.log(`Overriding with forced document: ${forcedDoc.title}`);
        }
      }
  
      // Fallback response if no relevant document is found
      if (!relevantDoc) {
        const fallbackMessage = {
          role: 'assistant',
          content: 'Sorry, I could not find relevant information in the documentation. Please try rephrasing your question or ask about another topic.',
        };
        setChat(prev => [...prev, fallbackMessage]);
        setIsLoading(false); // Ensure loading state is reset
        return; // Exit the function early
      }
  
      let contextPrompt = '';
      if (relevantDoc) {
        contextPrompt = `\nI've found some relevant information from our documentation that may help with this question:
  Title: ${relevantDoc.title}
  Content: ${relevantDoc.content}
  
  IMPORTANT: Use this information to help answer the question. When asked about pricing, features, or app details, base your answer on this documentation.`;
      }
  
      const response = await cohere.generate({
        model: 'command',
        prompt: `You are an AI assistant named Panoptis. You always speak in the user's language. You are kind and helpful.${contextPrompt}
  
  Recent conversation:
  ${chat.slice(-3).map(msg => `${msg.role === 'user' ? 'Human' : 'Panoptis'}: ${msg.content}`).join('\n')}
  
  H: ${message}
  Panoptis:`,
        maxTokens: 300,
        temperature: 0.7,
        k: 0,
        stopSequences: ['Human:', 'İnsan:'],
        returnLikelihoods: 'NONE',
      });
  
      const botResponse = response.generations[0]?.text.trim() || 'Sorry, an error occurred.';
  
      const botMessage = {
        role: 'assistant',
        content: botResponse,
      };
  
      setChat(prev => [...prev, botMessage]);
      triggerConfetti();
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = {
        role: 'assistant',
        content: 'Sorry, I cannot respond at the moment. Please try again.',
      };
      setChat(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Rest of your component code remains the same
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-dark-start to-dark-end">
      {/* Mobile Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:hidden glass-panel m-4 p-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <motion.img
            src="/panoptis512Blue.webp"/* panoptis512green.webp ele_2.webp*/
            alt="Panoptis Logo"
            width={120}
            height={120}
            className="rounded-full"
            whileHover={{ scale: 1.1 }}
          />
          <h1 className="text-xl font-bold gradient-text">Panoptis AI</h1>
        </div>
        <div className="text-sm text-gray-400">
          {chat.length} messages
        </div>
      </motion.div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 max-w-[1800px] mx-auto w-full">
        {/* Left Panel - Desktop Only */}
        <motion.div 
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex w-80 glass-panel p-6 flex-col gap-4 h-[calc(100vh-2rem)] sticky top-4"
        >
          <h2 className="text-2xl font-bold gradient-text">Features</h2>
          <motion.ul className="space-y-4">
            {['Multi Language Support', 'Instant Responses', 'AI-Powered', 'Personalized Experience', 'App Knowledge Integration'].map((feature, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-2 text-gray-300"
              >
                <SparklesIcon className="w-5 h-5 text-primary" />
                {feature}
              </motion.li>
            ))}
          </motion.ul>
        
          <div className="mt-6 flex-1 flex flex-col">
            <h3 className="text-lg font-bold gradient-text mb-3">Available Documents</h3>
            
            {/* Enhanced scrollable container with visual indicators */}
            <div className="relative flex-1">
              {/* Scroll shadow indicators */}
              <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[rgba(0,0,0,0.5)] to-transparent z-10 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[rgba(0,0,0,0.5)] to-transparent z-10 pointer-events-none"></div>
              
              {/* The scrollable content area */}
              <div className="overflow-y-auto h-full pr-2 custom-scrollbar max-h-[240px] scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                <motion.ul className="space-y-3">
                  {documentRepository.map((doc, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-2 text-gray-300 text-sm hover:bg-[rgba(255,255,255,0.1)] p-2 rounded-lg transition-colors cursor-pointer"
                    >
                      <DocumentTextIcon className="w-4 h-4 text-primary flex-shrink-0" />
                      <span className="truncate">{doc.title}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              </div>
            </div>
          </div>
          
          {/* Remove the animated image div with mt-auto */}
        </motion.div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-h-[calc(100vh-8rem)] lg:min-h-[calc(100vh-2rem)]">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel chat-container w-full flex flex-col flex-1"
          >
            {/* Mobile Features Menu */}
            <motion.div className="lg:hidden p-4 border-b border-gray-800">
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-400 flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4" />
                  Features
                </summary>
                <ul className="mt-2 space-y-2 pl-6">
                  {['Multi Language Support', 'Instant Responses', 'AI-Powered', 'Personalized Experience', 'App Knowledge Integration'].map((feature, index) => (
                    <li key={index} className="text-gray-300 text-sm">• {feature}</li>
                  ))}
                </ul>
              </details>
            
              {/* Add document menu for mobile */}
              <details className="text-sm mt-3">
                <summary className="cursor-pointer text-gray-400 flex items-center gap-2">
                  <DocumentTextIcon className="w-4 h-4" />
                  Documents
                </summary>
                <div className="mt-2 max-h-[200px] overflow-y-auto custom-scrollbar pl-6">
                  <ul>
                    {documentRepository.map((doc, index) => (
                      <li key={index} className="text-gray-300 text-sm py-1">• {doc.title}</li>
                    ))}
                  </ul>
                </div>
              </details>
            </motion.div>

            <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-4 p-4 messages-container">
              <AnimatePresence>
                {chat.map((msg, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse ml-auto' : 'mr-auto'}`}
                  >
                    {msg.role === 'assistant' && (
                      <motion.img
                        src="/panoptis512Blue.webp"
                        alt="Panoptis Logo"
                        width={70}
                        height={70}
                        className="animate-glow rounded-full mt-1"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      />
                    )}
                    <div className={`p-4 rounded-lg max-w-[80%] sm:max-w-[70%] ${
                      msg.role === 'user'
                        ? 'message-gradient'
                        : 'glass-panel'
                    }`}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 text-gray-400"
                >
                  <SparklesIcon className="w-5 h-5 animate-spin" />
                  <span>Panoptis is thinking...</span>
                </motion.div>
              )}
            </div>

            <motion.form
              onSubmit={handleSubmit}
              className="p-4 flex gap-2 sticky bottom-0 bg-[rgba(0,0,0,0.3)] backdrop-blur-lg"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 p-4 rounded-lg bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <motion.button
                type="submit"
                disabled={isLoading}
                className="bg-gradient-to-r from-primary to-secondary p-4 rounded-lg text-white disabled:opacity-50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <PaperAirplaneIcon className="w-6 h-6" />
              </motion.button>
            </motion.form>
          </motion.div>
        </div>

        {/* Right Panel - Desktop Only */}
        <motion.div 
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex w-80 glass-panel p-6 flex-col gap-4 h-[calc(100vh-2rem)] sticky top-4"
        >
          <h2 className="text-2xl font-bold gradient-text">Statistics</h2>
          <div className="space-y-4">
            {[
              { label: 'Total Messages', value: chat.length },
              { label: 'User Messages', value: chat.filter(m => m.role === 'user').length },
              { label: 'Panoptis Replies', value: chat.filter(m => m.role === 'assistant').length }
            ].map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-panel p-4 rounded-lg"
              >
                <div className="text-sm text-gray-400">{stat.label}</div>
                <div className="text-2xl font-bold gradient-text">{stat.value}</div>
              </motion.div>
            ))}
          </div>
        
          <div className="mt-6">
            <h3 className="text-lg font-bold gradient-text mb-3">Knowledge Base</h3>
            <div className="glass-panel p-4 rounded-lg">
              <p className="text-gray-300 text-sm">
                Panoptis has access to {documents.length} documents about the app, allowing it to provide accurate information about features, pricing, and frequently asked questions.
              </p>
            </div>
          </div>
          
          {/* Add the animated image here */}
          <div className="mt-6">
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 5,
                repeat: Infinity,
                repeatType: "reverse"
              }}
              className="w-full aspect-square rounded-lg glass-panel flex items-center justify-center"
            >
              <Image src="/panoptis512Blue.webp" alt="Panoptis" width={200} height={200} className="w-48 h-48" />
            </motion.div>
          </div>
        </motion.div>

      {/* Mobile Bottom Menu */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="lg:hidden fixed bottom-0 left-0 right-0 glass-panel p-4 border-t border-gray-800"
      >
        <div className="flex justify-around items-center">
          <div className="text-center">
            <div className="text-sm text-gray-400">Messages</div>
            <div className="text-lg font-bold gradient-text">{chat.length}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">User</div>
            <div className="text-lg font-bold gradient-text">{chat.filter(m => m.role === 'user').length}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Panoptis</div>
            <div className="text-lg font-bold gradient-text">{chat.filter(m => m.role === 'assistant').length}</div>
          </div>
        </div>
      </motion.div>
    </div>

    {/* Footer - Responsive */}
      <motion.footer 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 mb-20 lg:mb-0 glass-panel py-8 lg:py-12 px-4"
      >
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div>
            <h3 className="text-xl font-bold gradient-text mb-4">About Panoptis AI</h3>
            <p className="text-gray-300">
              Panoptis AI is a next-generation chat assistant that leverages advanced AI technology to provide powerful language support, powered by Coheres cutting-edge natural language processing capabilities.
            </p>
          </div>
          <div>
            <h3 className="text-xl font-bold gradient-text mb-4">Technologies</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Next.js 14</li>
              <li>• Cohere AI</li>
              <li>• Framer Motion</li>
              <li>• Tailwind CSS</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xl font-bold gradient-text mb-4">Contact</h3>
            <p className="text-gray-300">
              Contact us for questions or suggestions.  
              <br />
              Email: info@Panoptis.ai
            </p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}