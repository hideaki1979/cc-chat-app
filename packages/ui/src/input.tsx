"use client";

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    label,
    error,
    helperText,
    className = '',
    id,
    ...props
  }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    const inputClasses = `
      block w-full px-4 py-4 border-2 rounded-xl shadow-sm focus:outline-none focus:ring-4 focus:ring-opacity-30 text-base transition-all duration-200 bg-white dark:bg-gray-800
      ${error
        ? 'border-red-300 text-red-900 placeholder-red-400 focus:ring-red-500 focus:border-red-500 dark:border-red-400 dark:text-red-400'
        : 'border-gray-200 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400'
      }
      ${props.disabled
        ? 'bg-gray-50 cursor-not-allowed dark:bg-gray-700'
        : 'hover:border-gray-300 dark:hover:border-gray-600'
      }
      ${className}
    `.trim().replace(/\s+/g, ' ');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="mt-4 text-base text-red-600 dark:text-red-400 flex items-center">
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-helper`} className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';