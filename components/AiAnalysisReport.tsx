import React, { useState } from 'react';
import BackendStatusIndicator from './BackendStatusIndicator';
import { MailIcon, SpinnerIcon, CheckIcon } from './icons';

interface AiAnalysisReportProps {
  report: string;
  email: string;
  ecgImages: (string | null)[];
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'error';

// Basic markdown-to-HTML parser
const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const renderContent = () => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
      .replace(/### (.*?)\n/g, '<h3 class="text-xl font-semibold mt-4 mb-2 text-cyan-400">$1</h3>') // h3
      .replace(/## (.*?)\n/g, '<h2 class="text-2xl font-bold mt-6 mb-3 text-cyan-300">$1</h2>') // h2
      .replace(/-\s(.*?)\n/g, '<li class="ml-5 list-disc">$1</li>') // List items
      .split('\n').map((line, i) => {
        if (line.startsWith('<li')) {
          const prevLine = content.split('\n')[i-1];
          const openUl = !prevLine || !prevLine.startsWith('- ') ? '<ul>' : '';
          const nextLine = content.split('\n')[i+1];
          const closeUl = !nextLine || !nextLine.startsWith('- ') ? '</ul>' : '';
          return <React.Fragment key={i}> 
            {openUl && <div dangerouslySetInnerHTML={{ __html: openUl }} />}
            <div dangerouslySetInnerHTML={{ __html: line }} />
            {closeUl && <div dangerouslySetInnerHTML={{ __html: closeUl }} />}
          </React.Fragment>;
        }
        if (line.startsWith('<h') || line.startsWith('<strong')) {
           return <div key={i} dangerouslySetInnerHTML={{ __html: line }} />;
        }
        return <p key={i} className="mb-2 text-gray-300">{line}</p>;
      });
  };

  return <div className="prose prose-invert max-w-none">{renderContent()}</div>;
};

const AiAnalysisReport: React.FC<AiAnalysisReportProps> = ({ report, email, ecgImages }) => {
  const [sendStatus, setSendStatus] = useState<SendStatus>('idle');

  const handleSendEmail = async () => {
    setSendStatus('sending');
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
    
    try {
      const response = await fetch(`${backendUrl}/send-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          report: report,
          ecgImages: ecgImages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      
      setSendStatus('sent');
    } catch (error) {
      console.error('Failed to send email:', error);
      setSendStatus('error');
    }
  };

  const getButtonContent = () => {
    switch(sendStatus) {
      case 'sending':
        return <><SpinnerIcon /> Sending...</>;
      case 'sent':
        return <><CheckIcon /> Sent Successfully!</>;
      case 'error':
        return 'Retry Sending Report';
      default:
        return <><MailIcon /> Send Report via Email</>;
    }
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700/50 shadow-lg p-6 flex flex-col h-full">
      <div className="flex-shrink-0">
          <h2 className="text-3xl font-bold text-white mb-4">AI Analysis Report</h2>
      </div>
      <div className="flex-grow max-h-[500px] overflow-y-auto pr-4 text-gray-300 space-y-4">
        <MarkdownRenderer content={report} />
      </div>
      <div className="flex-shrink-0 mt-6 pt-6 border-t border-gray-700/50">
          <div className="flex justify-between items-center mb-4">
              <BackendStatusIndicator />
          </div>
          <div className="bg-yellow-900/50 border border-yellow-700/60 text-yellow-200 text-sm rounded-lg p-3 mb-4 text-center">
            <strong>Demo Notice:</strong> All reports are sent to the verified admin email. The address you entered (<strong>{email}</strong>) will be noted in the report body.
          </div>
          <button
            onClick={handleSendEmail}
            disabled={sendStatus === 'sending' || sendStatus === 'sent'}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-lg transition-all duration-200
              ${sendStatus === 'idle' && 'bg-cyan-600 hover:bg-cyan-700 text-white'}
              ${sendStatus === 'sending' && 'bg-gray-600 text-gray-300 cursor-not-allowed'}
              ${sendStatus === 'sent' && 'bg-green-600 text-white cursor-not-allowed'}
              ${sendStatus === 'error' && 'bg-red-600 hover:bg-red-700 text-white'}
            `}
          >
           {getButtonContent()}
          </button>
          {sendStatus === 'error' && <p className="text-red-400 text-sm mt-2 text-center">Failed to send email. Please check backend status and try again.</p>}
      </div>
    </div>
  );
};

export default AiAnalysisReport;
