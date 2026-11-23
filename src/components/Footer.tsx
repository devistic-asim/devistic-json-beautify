export function Footer({ onData }: { onData: () => void }) {
  return (
    <footer className="footer">
      <p>Devistic JSON Beautify</p>
      <nav aria-label="Contact">
        <a href="https://github.com/devistic-asim" target="_blank" rel="noopener noreferrer">
          GitHub profile
        </a>
        <a
          href="https://github.com/devistic-asim/devistic-json-beautify"
          target="_blank"
          rel="noopener noreferrer"
        >
          Star or contribute
        </a>
        <button type="button" className="linkish" onClick={onData}>
          Your data
        </button>
      </nav>
    </footer>
  );
}
