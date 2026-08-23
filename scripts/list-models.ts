import 'dotenv/config';

async function main() {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`
  );
  const data = await res.json();

  const models = data.models ?? [];
  const usable = models.filter((m: any) =>
    m.supportedGenerationMethods?.includes('generateContent')
  );

  console.log(`Total model yang bisa dipakai: ${usable.length}\n`);
  usable.forEach((m: any) => {
    console.log(m.name.replace('models/', ''));
  });
}

main();