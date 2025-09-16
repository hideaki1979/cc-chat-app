'use client';

export function BackButton() {
    return (
        <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 bg-gray-100 text-gray-700 text-base font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors duration-200 ml-0 sm:ml-4"
            data-testid="back-button"
        >
            <svg
                className="mr-2 h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16l-4-4m0 0l4-4m-4 4h18"
                />
            </svg>
            前のページに戻る
        </button>
    );
}


