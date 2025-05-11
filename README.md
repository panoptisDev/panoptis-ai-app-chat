# Panoptis Chat

Panoptis Chat is a modern web application that allows your apps users to chat with artificial intelligence about the app's features using the Hugging Face API.

---

## 🚀 Features

- **Modern and User-Friendly Interface**  
- **Real-Time Chat Experience**  
- **Hugging Face AI Model Integration**  
- **Responsive Design**  
- **Type Safety with TypeScript**  
- **Modern Styling with Tailwind CSS**

---

## 🛠️ Technologies

- **Next.js 14**  
- **React**  
- **TypeScript**  
- **Tailwind CSS**  
- **Hugging Face Inference API**

---

## 📦 Setup

### 1. Clone the Project
```bash
git clone [repo-url]
cd Panoptis-chat
```

### 2. Install Dependencies
```bash
yarn
```

### 3. Create a `.env` File
Add your API keys to a `.env` file:
```env
NEXT_PUBLIC_HF_TOKEN=YOUR_HUGGING_FACE_API_KEY
NEXT_PUBLIC_COHERE_API_KEY=YOUR_COHERE_API_KEY
```

### 4. Start the Development Server
```bash
nvm use 20.16.0
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📝 Usage

1. Add information about your app/dApp in the `public/docs` folder.  
   Example files: `faq.txt`, `features.txt`, `pricing.txt`.

2. Update the `documentRepository` in `src/app/data/documentRepository.ts` to include your app information:
   ```typescript
   { id: 'features', title: 'App Features', path: '/docs/features.txt' },
   ```

3. Your documents will appear in frontend under **"Available Documents"** on the left panel.  
   The **"Knowledge Base"** on the right panel will show how many documents the bot can retrieve data from.

4. Use the chat interface on the homepage:
   - Type your message in the message box.
   - Click the send button.
   - Wait for Panoptis to respond.

---

## 🛠️ Development Notes

### Key Steps in Development:
- Created the Next.js project.
- Added Hugging Face Inference package.
- Designed the homepage and chat interface.
- Integrated the API.
- Added online chat functionalities.

---

## 📜 License

This project is licensed under the **MIT License**.

---

## ✨ Contributing

Feel free to contribute to this project by submitting issues or pull requests. For major changes, please open an issue first to discuss what you would like to change.

---

## 📧 Contact

For questions or suggestions, contact me at:  
**telegram:** t.me/PanoptisNetwork
**github:** https://github.com/panoptisDev

If you find the app useful star it on github 
Enjoy! //panoptisDev