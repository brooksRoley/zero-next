import Head from 'next/head';
import NanuPikaAdventures from 'src/components/nanu-pika-td.jsx';

export default function NanuPikaTDPage() {
  return (
    <>
      <Head>
        <title>Nanu &amp; Pika TD | Brooks Roley</title>
        <meta name="description" content="Tower defense with cat wizards. Place towers, survive ant waves, level up." />
        <meta property="og:title" content="Nanu & Pika TD | Brooks Roley" />
        <meta property="og:description" content="Tower defense with cat wizards. Place towers, survive ant waves, level up." />
        <meta property="og:image" content="/lion.jpg" />
      </Head>
      <NanuPikaAdventures />
    </>
  );
}
