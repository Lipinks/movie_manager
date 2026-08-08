import ReactDOM from 'react-dom/client';

// Base layers first: tokens, then the shared shells. Importing these before
// App means component stylesheets load after them and can override a shared
// rule when they genuinely need to, rather than the other way round.
import './styles/theme.css';
import './styles/modal.css';
import './styles/cards.css';

import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
