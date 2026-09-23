"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { generateReferenceId } from "@/utils/errorNormalizer";

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  referenceId: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    referenceId: "",
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true, referenceId: generateReferenceId() };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[REACT ERROR BOUNDARY ${this.state.referenceId}]`, error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, referenceId: "" });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[240px] flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-xl mb-3">
            ⚠️
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">
            {this.props.fallbackTitle || "Unable to display this section"}
          </h3>
          <p className="text-slate-500 text-sm max-w-sm mb-4">
            {this.props.fallbackMessage || "An unexpected rendering problem occurred. Please try refreshing."}
          </p>
          <div className="text-xs text-slate-400 font-mono mb-4">
            Reference ID: {this.state.referenceId}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-xs rounded-lg transition"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs rounded-lg transition"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
