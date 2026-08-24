import fs from "fs";

async function run() {
  const dir = "C:\\WeddingPhotos\\ArunDivya";
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    console.log("No directory");
    return;
  }
  if (files.length === 0) {
    console.log("No files found");
    return;
  }
  
  // Find a jpg file
  const file = files.find(f => f.endsWith('.jpg') || f.endsWith('.jpeg')) || files[0];
  console.log("Using file:", file);
  
  const buffer = fs.readFileSync(`${dir}\\${file}`);
  
  const formData = new FormData();
  const blob = new Blob([new Uint8Array(buffer)], { type: "image/jpeg" });
  formData.append("selfie", blob, "selfie.jpg");

  console.log("Sending request to AI service...");
  try {
    const response = await fetch("http://localhost:8001/api/ai/selfie", {
      method: "POST",
      body: formData,
    });
    
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response len:", text.length);
    
    try {
      const data = JSON.parse(text);
      if (data.embedding) {
        console.log("Embedding length:", data.embedding.length);
        console.log("First 3 elements:", data.embedding.slice(0, 3));
      } else {
        console.log("Data:", data);
      }
    } catch (e) {
      console.log("Not JSON");
    }
  } catch (err) {
    console.error("Fetch failed", err);
  }
}
run();
