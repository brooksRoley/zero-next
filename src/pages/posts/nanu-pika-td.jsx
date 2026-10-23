import Head from 'next/head';
import NanuPikaAdventures from 'src/components/nanu-pika-td.jsx';

export default function NanuPikaTDPage() {
  return (
    <>
      <Head>
        <title>Tower Defense: Nanu Pika | Brooks Roley</title>
        <meta name="description" content="Tower defense with cat wizards. Place towers, survive ant waves, level up." />
        <meta property="og:title" content="Tower Defense: Nanu Pika | Brooks Roley" key="og:title" />
        <meta property="og:description" content="Tower defense with cat wizards. Place towers, survive ant waves, level up." key="og:description" />
        <meta property="og:image" content="/lion.jpg" key="og:image" />
      </Head>
      <NanuPikaAdventures />
    </>
  );
}
