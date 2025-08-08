"use client";

import React from 'react';

interface FormCardProps {
    children: React.ReactNode;
    className?: string;
}

export const FormCard: React.FC<FormCardProps> = ({
    children,
    className = '',
}) => {
    const cardClasses = `
    bg-white dark:bg-gray-800 shadow-2xl rounded-2xl border border-gray-100 dark:border-gray-700 p-8 sm:p-10
    ${className}
  `.trim().replace(/\s+/g, ' ');

    return (
        <div className={cardClasses}>
            {children}
        </div>
    );
};

interface FormHeaderProps {
    title: string;
    subtitle: React.ReactNode;
    icon: React.ReactNode;
}

export const FormHeader: React.FC<FormHeaderProps> = ({
    title,
    subtitle,
    icon,
}) => {
    return (
        <div className="text-center mb-6">
            <div className="mx-auto h-14 w-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                {icon}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {title}
            </h2>
            <p className="text-md text-gray-600 dark:text-gray-400">
                {subtitle}
            </p>
        </div>
    );
};

interface FormContainerProps extends React.FormHTMLAttributes<HTMLFormElement> {
    children: React.ReactNode;
    className?: string;
}

export const FormContainer: React.FC<FormContainerProps> = ({
    children,
    className = '',
    ...props
}) => {
    const containerClasses = `
    space-y-6
    ${className}
  `.trim().replace(/\s+/g, ' ');

    return (
        <form className={containerClasses} {...props}>
            {children}
        </form>
    );
};

interface FormFieldsProps {
    children: React.ReactNode;
}

export const FormFields: React.FC<FormFieldsProps> = ({ children }) => {
    return (
        <div className="space-y-4">
            {children}
        </div>
    );
};

interface FormFooterProps {
    children: React.ReactNode;
}

export const FormFooter: React.FC<FormFooterProps> = ({ children }) => {
    return (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {children}
            </p>
        </div>
    );
}; 