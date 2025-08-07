import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from '@repo/ui/button'

describe('Button Component', () => {
  test('renders button with text', () => {
    render(<Button>Test Button</Button>)
    expect(screen.getByRole('button', { name: /test button/i })).toBeInTheDocument()
  })

  test('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Click me</Button>)
    
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('applies variant classes correctly', () => {
    render(<Button variant="primary">Primary Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gradient-to-r', 'from-blue-500', 'to-purple-600')
  })

  test('applies size classes correctly', () => {
    render(<Button size="lg">Large Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('px-8', 'py-6', 'text-lg')
  })

  test('displays loading state', () => {
    render(<Button isLoading={true}>Loading Button</Button>)
    expect(screen.getByText('処理中...')).toBeInTheDocument()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  test('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled Button</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  test('is disabled when loading', () => {
    render(<Button isLoading>Loading Button</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  test('renders danger variant correctly', () => {
    render(<Button variant="danger">Danger Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gradient-to-r', 'from-red-500', 'to-pink-600')
  })

  test('renders secondary variant correctly', () => {
    render(<Button variant="secondary">Secondary Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gray-100')
  })

  test('renders ghost variant correctly', () => {
    render(<Button variant="ghost">Ghost Button</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('bg-transparent')
  })
})