
import { GoogleGenAI } from "@google/genai";
import { Product } from "@/types";

// Always use process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAiRecommendation = async (userMessage: string, products: Product[]) => {
  const model = "gemini-3-flash-preview";
  
  const productList = products.map(p => `${p.name} (${p.category}): ${p.description} - Rp${p.price}`).join('\n');

  const prompt = `
    Anda adalah asisten belanja pintar untuk "MWSTORE". 
    Tugas Anda adalah membantu pelanggan menemukan produk yang tepat berdasarkan kebutuhan mereka.
    
    Daftar Produk yang tersedia:
    ${productList}
    
    Pertanyaan Pelanggan: "${userMessage}"
    
    Berikan jawaban yang ramah, informatif, dan rekomendasikan maksimal 2 produk yang paling relevan. 
    Gunakan Bahasa Indonesia yang sopan. Jika tidak ada yang relevan, beri tahu mereka dan tawarkan bantuan lain.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Maaf, asisten AI sedang mengalami kendala. Silakan coba lagi nanti.";
  }
};
