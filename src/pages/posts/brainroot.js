import Link from 'next/link';
import Head from 'next/head';

export default function Brainroot() {
  return (
    <>
      <Head>
        <title>Brainroot - Sparkling Water for Your Mind</title>
        <style>{`
          body, html {
            height: 100%;
            margin: 0;
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .parallax {
            height: 100vh;
            background-attachment: fixed;
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .content {
            background-color: rgba(255, 255, 255, 0.8);
            padding: 20px;
            border-radius: 10px;
            max-width: 800px;
            margin: 0 auto;
          }
          h1, h2 {
            color: #0066cc;
          }
          .cta-button {
            display: inline-block;
            background-color: #0066cc;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
          footer {
            background-color: #333;
            color: white;
            text-align: center;
            padding: 10px 0;
          }
        `}</style>
      </Head>

      <div className="parallax" style={{backgroundColor: 'GrayText', backgroundImage: "url('../BRLogoTransparent.png')"}}>
        <div className="content">
          <h1>Brainroot: Spark Your Imagination</h1>
          <p>Introducing Brainroot, the revolutionary sparkling water designed to elevate your cognitive function, inspire creativity, and add a splash of fun to your day!</p>
        </div>
      </div>

      <div className="parallax" style={{backgroundImage: "url('../covertitle.jpg')"}}>
        <div className="content">
          <h2>Why Choose Brainroot?</h2>
          <ul>
            <li>Enhances mental clarity and focus</li>
            <li>Boosts creative thinking and problem-solving skills</li>
            <li>Refreshing, all-natural ingredients</li>
            <li>Zero calories, zero sugar</li>
            <li>Delightful, effervescent taste</li>
          </ul>
        </div>
      </div>

      <div className="parallax" style={{backgroundImage: "url('../water1.jpg')"}}>
        <div className="content">
          <h2>Ignite Your Brain, Quench Your Thirst</h2>
          <p>Brainroot is more than just a beverage – it&apos;s a catalyst for innovation and imagination. Our unique blend of nootropic ingredients and sparkling water creates the perfect balance of refreshment and mental stimulation.</p>
        </div>
      </div>

      <div className="parallax" style={{backgroundImage: "url('../lion.jpg')"}}>
        <div className="content">
          <h2>Join the Brainroot Revolution</h2>
          <p>Ready to transform your cognitive experience? Try Brainroot today and discover a world of limitless possibilities.</p>
          <Link href="/cart" className="cta-button">
            Shop Brainroot Now
          </Link>
        </div>
      </div>

      <footer>
        <p>&copy; 2024 Brainroot Beverages. All rights reserved.</p>
      </footer>
    </>
  );
}