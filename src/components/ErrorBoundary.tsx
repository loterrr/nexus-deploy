'use client';
import { Component, ReactNode } from 'react';
interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}
interface State {
    hasError: boolean;
    error?: Error;
}
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: any) {
        console.error('Error caught by boundary:', error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return this.props.fallback || (
                <div className="flex items-center justify-center h-screen">
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-red-500">Something went wrong</h2>
                        <p className="text-slate-400 mt-2">{this.state.error?.message}</p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}