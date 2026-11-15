import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App integration', () => {
  it('renders Hoje dashboard after seeding and switches between main tabs', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Hoje em Casa')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Casa, Stock & Receitas/i)).not.toBeInTheDocument();

    const stockButtons = screen.getAllByRole('button', { name: /^Stock$/i });
    fireEvent.click(stockButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Stock da Casa')).toBeInTheDocument();
    });

    const recipesButtons = screen.getAllByRole('button', { name: /^Receitas$/i });
    fireEvent.click(recipesButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('As Nossas Receitas')).toBeInTheDocument();
    });

    const plannerButtons = screen.getAllByRole('button', { name: /^Ementa$/i });
    fireEvent.click(plannerButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Ementa Semanal')).toBeInTheDocument();
    });

    const shoppingButtons = screen.getAllByRole('button', { name: /Compras/i });
    fireEvent.click(shoppingButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Lista de Compras')).toBeInTheDocument();
    });

    const settingsButton = screen.getByRole('button', { name: /Definições e Família/i });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Acerca/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Acerca/i }));

    await waitFor(() => {
      expect(screen.getByText('AI-Cenas92')).toBeInTheDocument();
    });
  });
});
