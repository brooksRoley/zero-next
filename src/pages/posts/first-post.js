import Link from 'next/link';
import Head from 'next/head';
import Layout from '../../components/layout';

export default function FirstPost() {

  const fetchApi = () => {
    // Fetching data
    fetch('http://your-python-api-url/api/data')
    .then(response => response.json())
    .then(data => console.log(data));

    // Adding data
    fetch('http://your-python-api-url/api/data', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({column1: 'value1', column2: 'value2'}),
    })
    .then(response => response.json())
    .then(result => console.log(result));
  }

  return (
    <Layout>
      <Head>
        <title>First Post</title>
      </Head>
      <h1>I would love to take a second to talk about my history and what motivates me.</h1>
      <h2>

      </h2>

      <Link 
        href="/"
      >
        Back to home
      </Link>
    </Layout>
  );
}
