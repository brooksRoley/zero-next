import Head from 'next/head';
import NanuPikaAdventures from 'src/components/nanu-pika-td.jsx';
import SupportCta from 'src/components/SupportCta';

export default function NanuPikaTDPage() {
  return (
    <>
      <Head>
        <title>Nanu &amp; Pika TD | Brooks Roley</title>
        <meta name="description" content="Tower defense with cat wizards. Place towers, survive ant waves, level up." />
        <meta property="og:title" content="Nanu & Pika TD | Brooks Roley" key="og:title" />
        <meta property="og:description" content="Tower defense with cat wizards. Place towers, survive ant waves, level up." key="og:description" />
        <meta property="og:image" content="/lion.jpg" key="og:image" />
      </Head>
      <NanuPikaAdventures />
      <footer className="bg-[#0a0c10] py-6 text-center">
        <SupportCta
          page="/posts/nanu-pika-td"
          location="nanu_pika_td_tip"
          label="Enjoying the game? Support development →"
        />
      </footer>
    </>
  );
}
