import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Crash satu halaman tidak boleh membuat seluruh aplikasi jadi layar putih. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error): void {
    console.error('Render error:', error);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-lg font-semibold">Terjadi kesalahan pada halaman ini</p>
          <p className="max-w-md text-sm text-gray-500">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Muat Ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
