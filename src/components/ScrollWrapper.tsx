"use client";

import React, { ReactNode } from 'react';
import PerfectScrollbar from 'react-perfect-scrollbar';
import 'react-perfect-scrollbar/dist/css/styles.css';

interface ScrollWrapperProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  options?: {
    suppressScrollX?: boolean;
    suppressScrollY?: boolean;
    wheelPropagation?: boolean;
    autoHide?: boolean;
    autoHideTimeout?: number;
  };
}

const ScrollWrapper: React.FC<ScrollWrapperProps> = ({ 
  children, 
  className = '', 
  style = {},
  options = {
    autoHide: true,
    autoHideTimeout: 1000,
    wheelPropagation: true
  }
}) => {
  return (
    <PerfectScrollbar
      className={className}
      style={style}
      options={options}
    >
      {children}
    </PerfectScrollbar>
  );
};

export default ScrollWrapper;
