import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

describe('App integration', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    window.location.hash = '';
  });

  it('renders Hoje dashboard after seeding and switches between main tabs', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Hoje em Casa' })).toBeInTheDocument();
    });
    expect(screen.queryByText(/Casa, Stock & Receitas/i)).not.toBeInTheDocument();
    expect(screen.queryByText('GF')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Gestão Familiar' })).not.toBeInTheDocument();

    const stockButtons = screen.getAllByRole('button', { name: /^Stock$/i });
    fireEvent.click(stockButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Stock da Casa' })).toBeInTheDocument();
      expect(screen.getByText(/produtos em casa/i)).toBeInTheDocument();
    });

    const mealsButtons = screen.getAllByRole('button', { name: /^Refeições$/i });
    fireEvent.click(mealsButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Ementa Semanal' })).toBeInTheDocument();
    });

    const recipesSubTab = screen.getByRole('tab', { name: /Receitas/i });
    fireEvent.click(recipesSubTab);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'As Nossas Receitas' })).toBeInTheDocument();
    });

    const plannerSubTab = screen.getByRole('tab', { name: /Ementa/i });
    fireEvent.click(plannerSubTab);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Ementa Semanal' })).toBeInTheDocument();
    });

    const shoppingButtons = screen.getAllByRole('button', { name: /Compras/i });
    fireEvent.click(shoppingButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Lista de Compras' })).toBeInTheDocument();
    });

    const financesButtons = screen.getAllByRole('button', { name: /^Finanças$/i });
    fireEvent.click(financesButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Finanças da Casa' })).toBeInTheDocument();
    });

    const settingsButton = screen.getByRole('button', { name: /Definições e Família/i });
    fireEvent.click(settingsButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Definições e Família' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Acerca/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Acerca/i }));

    await waitFor(() => {
      expect(screen.getByText('AI-Cenas92')).toBeInTheDocument();
    });
  });

  it('switches between Clean and Complete modes from header & Settings and preserves per-tab customization', async () => {
    window.localStorage.clear();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Hoje em Casa' })).toBeInTheDocument();
    });

    // Starts in Clean mode by default
    const densityToggle = screen.getByRole('button', { name: /Vista Clean ativa/i });
    expect(densityToggle).toHaveTextContent('Clean');
    expect(screen.queryByText('Alertas Prioritários')).not.toBeInTheDocument();

    // Switch to Complete mode via top bar toggle
    fireEvent.click(densityToggle);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Vista Completa ativa/i })).toHaveTextContent(
        'Completa',
      );
      expect(screen.getByRole('button', { name: /\+ Produto/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\+ Receita/i })).toBeInTheDocument();
      expect(screen.getByText('Alertas Prioritários')).toBeInTheDocument();
    });

    // Navigate to Stock -> Complete mode shows "abaixo do mínimo" subtitle, Catálogo button & Cartões padrão
    fireEvent.click(screen.getAllByRole('button', { name: /^Stock$/i })[0]);
    await waitFor(() => {
      expect(screen.getByText(/abaixo do mínimo/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Catálogo' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cartões padrão' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    // Customize Stock to Quadrados while staying in Complete mode
    fireEvent.click(screen.getByRole('button', { name: 'Grelha em quadrados' }));
    expect(screen.getByRole('button', { name: 'Grelha em quadrados' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // Switch away and back to Stock -> custom Quadrados view stays intact
    fireEvent.click(screen.getAllByRole('button', { name: /^Refeições$/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Receitas/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('tab', { name: /Receitas/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cartões padrão' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Stock$/i })[0]);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Grelha em quadrados' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    // Switch back to Clean via Settings -> Aspeto e Vista da App
    fireEvent.click(screen.getByRole('button', { name: /Definições e Família/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Aspeto e Vista da App/i })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Aspeto e Vista da App/i }));
    fireEvent.click(screen.getByRole('button', { name: /Vista Clean \(predefinida\)/i }));

    expect(screen.getByRole('button', { name: /Vista Clean ativa/i })).toHaveTextContent('Clean');
    fireEvent.click(screen.getAllByRole('button', { name: /^Stock$/i })[0]);
    await waitFor(() => {
      expect(screen.getByText(/produtos em casa/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Lista compacta em linha' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });
});
