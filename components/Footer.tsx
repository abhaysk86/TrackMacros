import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="w-full py-4 text-center mt-auto border-t border-slate-800 bg-slate-950">
      <p className="text-slate-500 text-xs">
        Built by{' '}
        <a 
          href="https://theabhayperspective.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline text-primary hover:text-cyan-400 transition-colors"
        >
          Theabhayperspective
        </a>
      </p>
    </footer>
  );
};

export default Footer;