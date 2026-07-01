import React from 'react';
import './LoadingPage.css';

const LoadingPage = () => {
  return (
    <div className="loading-container">
      <div className="loading-content">
        <div className="orbital-system">
          <div className="central-orb"></div>
          <div className="orbit orbit-1">
            <div className="moon moon-1"></div>
          </div>
          <div className="orbit orbit-2">
            <div className="moon moon-2"></div>
          </div>
          <div className="orbit orbit-3">
            <div className="moon moon-3"></div>
          </div>
        </div>
        <div className="loading-text">
          <span>L</span>
          <span>O</span>
          <span>A</span>
          <span>D</span>
          <span>I</span>
          <span>N</span>
          <span>G</span>
        </div>
        <div className="progress-bar">
          <div className="progress-fill"></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingPage;