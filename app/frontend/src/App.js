import { useEffect, useState } from 'react';

function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('http://127.0.0.1:5000/')
        .then(res => res.json())
        .then(json => setData(json));
  }, []);

  return (
      <div>
        <h1>Parkshare Dashboard</h1>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
  );
}

export default App;