/**
 * ErrorBoundary.tsx
 *
 * A safety net. If any component below this one throws while rendering, React
 * would normally unmount the entire app and leave a blank white page — no
 * message, no clue. This catches that and shows something readable instead.
 *
 * WHY IT IS A CLASS COMPONENT:
 * Everything else in this project is a function component, because that is how
 * modern React is written. Error boundaries are the one exception: catching a
 * render error requires the componentDidCatch lifecycle method, and React has
 * no hook equivalent. So this file looks older than the rest on purpose.
 *
 * WHAT IT DOES NOT CATCH:
 * Errors thrown inside event handlers, inside setTimeout, or inside promises.
 * Those never pass through React's rendering, so React cannot see them. Data
 * loading errors are handled separately by React Query in App.tsx.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  /** The error we caught, or null while everything is fine. */
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  /**
   * React calls this after a child throws, and uses what it returns as the new
   * state. Storing the error is what causes render() below to show the
   * fallback instead of the children.
   */
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  /**
   * Called after the error is caught, for logging. In a real production app
   * this is where you would report to an error tracking service.
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("A component crashed:", error, errorInfo.componentStack);
  }

  /** Clears the error so React tries to render the children again. */
  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;

    if (error === null) {
      return this.props.children;
    }

    return (
      <div className="error-screen" role="alert">
        <h1>Something went wrong</h1>

        <p>
          The map could not be displayed. The technical details are below, and
          there will usually be more in the browser console.
        </p>

        {/*
          A <pre> preserves the line breaks in the message, which matters
          because stack traces are unreadable without them.
        */}
        <pre className="error-screen__details">{error.message}</pre>

        <div className="error-screen__actions">
          <button type="button" className="button" onClick={this.handleReset}>
            Try again
          </button>

          <button
            type="button"
            className="button"
            onClick={() => window.location.reload()}
          >
            Reload the page
          </button>
        </div>

        <p className="error-screen__help">
          If this keeps happening, check <code>docs/gotchas.md</code> in
          this project.
        </p>
      </div>
    );
  }
}
