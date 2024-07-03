import Link from 'next/link';
import Head from 'next/head';
import Layout from '../../components/layout';

export default function FirstPost() {
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
