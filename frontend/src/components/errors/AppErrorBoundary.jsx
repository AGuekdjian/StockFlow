import { Component } from 'react';
import { ErrorPage } from '../../pages/ErrorPage.jsx';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('Unhandled render error', error, info);
  }

  render() {
    if (this.state.error)
      return (
        <ErrorPage
          status="Error inesperado"
          title="La aplicación encontró un problema"
          message="Tus datos no fueron modificados por este error de visualización. Intentá recargar la pantalla."
          onRetry={() => this.setState({ error: null })}
        />
      );
    return this.props.children;
  }
}
