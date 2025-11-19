import React, { useState, useEffect, useRef } from 'react';
import { useChat } from './hooks/useChat';
import { MessageBubble } from './components/MessageBubble';
import { ModelSelector } from './components/ModelSelector';

function App() {
  const {
    messages,
    isDiscussing,
    availableModels,
    startDiscussion,
    stopDiscussion,
    nextTurn,
  } = useChat();

  const [topic, setTopic] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStart = () => {
    if (!topic.trim() || selectedModels.length < 2) return;
    startDiscussion(topic, selectedModels);
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            xling discuss
          </h1>
          <p className="text-sm text-gray-500 mt-1">Multi-Agent Chat Room</p>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Topic
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none h-24 text-sm"
              placeholder="What should we discuss?"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isDiscussing}
            />
          </div>

          <ModelSelector
            availableModels={availableModels}
            selectedModels={selectedModels}
            onChange={setSelectedModels}
            disabled={isDiscussing}
          />
        </div>

        <div className="p-6 border-t border-gray-100 bg-gray-50">
          {!isDiscussing ? (
            <button
              onClick={handleStart}
              disabled={!topic.trim() || selectedModels.length < 2}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg shadow-lg shadow-blue-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Discussion
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={nextTurn}
                className="w-full py-2 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Trigger Next Turn
              </button>
              <button
                onClick={stopDiscussion}
                className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg transition-colors"
              >
                Stop Discussion
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50/50">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                </div>
                <h3 className="text-xl font-medium text-gray-900">Ready to Start</h3>
                <p className="text-gray-500 mt-2">Select models and a topic to begin the discussion.</p>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
