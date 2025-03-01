import { useState, useEffect, useRef } from "react";
import OpenAI from "openai";

// Basic dictionary for UI text in English and Vietnamese
const UI_TEXT = {
  vi: {
    managerLabel: "UselessAIagent: Quản lý dô dụng :).",
    usingVisionModel: "Sử dụng Vision Model",
    systemPromptLabel: "Lời nhắc hệ thống (mô tả bổ sung):",
    analysisOutputLabel: "Kết quả Phân tích:",
    logLabel: "Nhật ký (tối đa 20 kết quả):",
    startCamera: "Bật Camera",
    submit: "Gửi",
    startMonitoring: "Bắt đầu Giám sát",
    stopMonitoring: "Dừng Giám sát",
    speakPrompt: "Nói lời nhắc",
    repeat: "Lặp lại",
    stop: "Dừng",
    listeningForPrompt: "Đang lắng nghe lời nhắc...",
    recognizedSpeech: "Đã nhận diện lời nói. Đang gửi...",
    defaultPrompt: "Hệ thống giám sát: Phân tích đối tượng.",
  },
  en: {
    managerLabel: "UselessAIagent: Uselezzz manager :).",
    usingVisionModel: "Using Vision Model",
    systemPromptLabel: "System Prompt (additional description):",
    analysisOutputLabel: "Analysis Output:",
    logLabel: "Log (last 20 outputs):",
    startCamera: "Start Camera",
    submit: "Submit",
    startMonitoring: "Start Monitoring",
    stopMonitoring: "Stop Monitoring",
    speakPrompt: "Speak Prompt",
    repeat: "Repeat",
    stop: "Stop",
    listeningForPrompt: "Listening for prompt...",
    recognizedSpeech: "Recognized speech. Submitting...",
    defaultPrompt: "Monitoring system: Analyze the subject.",
  },
};

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [analysisPrompt, setAnalysisPrompt] = useState(UI_TEXT.vi.defaultPrompt);
  const [analysisOutput, setAnalysisOutput] = useState("");
  const [analysisLog, setAnalysisLog] = useState([]); // store logs (max 20)

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("Idle");
  const [language, setLanguage] = useState("vi");

  // Vision-capable model example
  const visionModel = "gpt-4o";

  const videoRef = useRef(null);
  const monitoringRef = useRef(false);
  const [monitorInterval, setMonitorInterval] = useState(5000); // Default interval: 5 seconds
  const recognitionRef = useRef(null);

  // On language change, update default prompt if user hasn't customized.
  useEffect(() => {
    const isViDefault = analysisPrompt === UI_TEXT.vi.defaultPrompt;
    const isEnDefault = analysisPrompt === UI_TEXT.en.defaultPrompt;

    if (!analysisPrompt || isViDefault || isEnDefault) {
      if (language === "vi") {
        setAnalysisPrompt(UI_TEXT.vi.defaultPrompt);
      } else {
        setAnalysisPrompt(UI_TEXT.en.defaultPrompt);
      }
    }
  }, [language]);

  // Refresh video sizing on window resize
  useEffect(() => {
    const handleResize = () => {
      if (videoRef.current) {
        videoRef.current.style.width = "100%";
        videoRef.current.style.height = "100%";
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const startCamera = async () => {
    try {
      setStatusMsg("Starting camera...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setStatusMsg("Camera started.");
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setError("Failed to access webcam.");
      setStatusMsg("Idle");
    }
  };

  // Capture one frame
  const captureFrame = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg");
    }
    return null;
  };

  const handleSubmit = async () => {
    setError("");
    if (!apiKey) {
      setError("API Key is required.");
      return;
    }

    setStatusMsg("Capturing frame...");
    setLoading(true);

    const imageData = captureFrame();
    if (!imageData) {
      setError("Failed to capture image.");
      setStatusMsg("Idle");
      setLoading(false);
      return;
    }

    setStatusMsg("Sending request to model...");

    const finalPrompt = analysisPrompt.trim();
    const base64Part = imageData.replace(/^data:image\/(?:png|jpeg);base64,/, "");

    const userContent = [
      {
        type: "text",
        text: finalPrompt,
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64Part}`,
          detail: "auto",
        },
      },
    ];

    try {
      const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

      const res = await openai.chat.completions.create({
        model: visionModel,
        messages: [
          {
            role: "user",
            content: userContent,
          },
        ],
        max_tokens: 1500,
      });

      const textResponse = res.choices[0].message.content;
      setAnalysisOutput(textResponse);
      addToLog(textResponse);
      speakText(textResponse);
      setStatusMsg("Received response and speaking.");
    } catch (err) {
      console.error("Error fetching AI response:", err);
      setError("Failed to fetch response. Please check your API key or model.");
      setStatusMsg("Idle");
    }

    setLoading(false);
  };

  const addToLog = (text) => {
    setAnalysisLog((prev) => {
      const newLog = [...prev, text];
      while (newLog.length > 20) {
        newLog.shift();
      }
      return newLog;
    });
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) {
      setError("This browser does not support speech synthesis.");
      return;
    }

    try {
      setStatusMsg("Speaking text.");
      const utterance = new SpeechSynthesisUtterance(text);
      if (language === 'vi') {
        utterance.lang = 'vi-VN';
      } else {
        utterance.lang = 'en-US';
      }

      utterance.onend = () => {
        setStatusMsg("Speech finished.");
        if (monitoringRef.current) {
          handleSubmit();
        }
      };

      speechSynthesis.speak(utterance);
    } catch (error) {
      console.error("Error using Web Speech API:", error);
      setError("Failed to speak text.");
      setStatusMsg("Idle");
    }
  };

  const handleStop = () => {
    speechSynthesis.cancel();
    setStatusMsg("Speech stopped.");
  };

  const handleRepeat = () => {
    if (!analysisOutput) {
      setError("No analysis output to speak.");
      return;
    }
    speakText(analysisOutput);
  };

  // Start continuous monitoring
  const handleStartMonitoring = () => {
    setError("");
    monitoringRef.current = true;
    setStatusMsg("Monitoring started.");
    const monitorLoop = async () => {
      if (monitoringRef.current) {
        await handleSubmit();
        setTimeout(monitorLoop, monitorInterval);
      }
    };
    monitorLoop();
    setError("");
    monitoringRef.current = true;
    handleSubmit();
    setStatusMsg("Monitoring started.");
  };

  // Stop continuous monitoring
  const handleStopMonitoring = () => {
    monitoringRef.current = false;
    setStatusMsg("Monitoring stopped.");
    speechSynthesis.cancel();
    monitoringRef.current = false;
    setStatusMsg("Monitoring stopped.");
    speechSynthesis.cancel();
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      setError("This browser does not support speech recognition.");
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = language === 'vi' ? 'vi-VN' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setStatusMsg(UI_TEXT[language].listeningForPrompt);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setAnalysisPrompt(transcript);
      setStatusMsg(UI_TEXT[language].recognizedSpeech);
      recognition.stop();
      handleSubmit();
    };

    recognition.onerror = (e) => {
      setError("Speech recognition error: " + e.error);
      setStatusMsg("Idle");
    };

    recognition.onend = () => {
      // no-op
    };
  };

  // We'll shorten references to the UI text so we don't repeat ourselves.
  const t = UI_TEXT[language];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row", // TWO COLUMNS
        width: "100vw",
        height: "100vh",
        margin: 0,
        backgroundColor: "#f0f0f0",
      }}
    >
      {/* Left Column: Video */}
      <div style={{ flex: 1, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            backgroundColor: "#ddd",
            padding: "4px 8px",
            margin: 0,
            color: "#333",
            fontSize: "0.9rem",
            borderBottomRightRadius: "8px",
            zIndex: 10,
          }}
        >
          {t.managerLabel}
        </div>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            border: "1px solid black",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Right Column: All other UI */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "20px",
        overflow: "hidden",
      }}>
        <div style={{ marginBottom: "20px" }}>
          <p>
            {t.usingVisionModel}: <strong>{visionModel}</strong>
          </p>

          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ marginRight: "5px", padding: "5px" }}
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
          <label style={{ marginLeft: "10px" }}>{t.monitoringIntervalLabel}</label>
          <input
            type="number"
            value={monitorInterval}
            onChange={(e) => setMonitorInterval(Math.max(1000, Number(e.target.value)))}
            style={{ width: "80px", marginLeft: "5px" }}
          />

          <input
            type="password"
            placeholder="Enter API Key"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{
              border: "1px solid #ccc",
              padding: "5px",
              marginRight: "5px",
              width: "200px",
            }}
          />

          <button
            onClick={startCamera}
            style={{
              backgroundColor: "green",
              color: "white",
              padding: "8px 16px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
              marginRight: "5px",
            }}
          >
            {t.startCamera}
          </button>

          <button
            onClick={handleSubmit}
            style={{
              backgroundColor: "blue",
              color: "white",
              padding: "8px 16px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
              marginRight: "5px",
            }}
            disabled={loading}
          >
            {loading ? "..." : t.submit}
          </button>

          <button
            onClick={handleStartMonitoring}
            style={{
              backgroundColor: "#b06",
              color: "white",
              padding: "8px 16px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
              marginRight: "5px",
            }}
          >
            {t.startMonitoring}
          </button>

          <button
            onClick={handleStopMonitoring}
            style={{
              backgroundColor: "#555",
              color: "white",
              padding: "8px 16px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
              marginRight: "5px",
            }}
          >
            {t.stopMonitoring}
          </button>

          <button
            onClick={handleVoiceInput}
            style={{
              backgroundColor: "#ca0",
              color: "white",
              padding: "8px 16px",
              borderRadius: "5px",
              border: "none",
              cursor: "pointer",
            }}
          >
            {t.speakPrompt}
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginBottom: "20px" }}>
          <p style={{ margin: 0, marginBottom: "5px" }}>{t.systemPromptLabel}</p>
          <textarea
            rows={3}
            value={analysisPrompt}
            onChange={(e) => setAnalysisPrompt(e.target.value)}
            style={{
              border: "1px solid #ccc",
              padding: "5px",
              width: "100%",
              resize: "vertical",
            }}
          />
        </div>

        {/* Status line in red */}
        <p style={{ color: "red", margin: "10px 0" }}>{statusMsg}</p>

        {/* Flexible container for output text area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <p style={{ margin: 0 }}>{t.analysisOutputLabel}</p>
          <textarea
            style={{
              flex: 1,
              marginTop: "5px",
              resize: "vertical",
              border: "1px solid #ccc",
              padding: "5px",
              minHeight: "100px",
              boxSizing: "border-box",
            }}
            value={analysisOutput}
            readOnly
          />

          <div style={{ marginTop: "5px" }}>
            <button
              onClick={handleRepeat}
              style={{
                backgroundColor: "#444",
                color: "white",
                padding: "5px 10px",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
                marginRight: "10px",
              }}
            >
              {t.repeat}
            </button>

            <button
              onClick={handleStop}
              style={{
                backgroundColor: "#888",
                color: "white",
                padding: "5px 10px",
                borderRadius: "5px",
                border: "none",
                cursor: "pointer",
              }}
            >
              {t.stop}
            </button>
          </div>
        </div>

        {/* Analysis Log below the output */}
        <div style={{ width: "100%", marginTop: "10px" }}>
          <p style={{ margin: 0 }}>{t.logLabel}</p>
          <div
            style={{
              border: "1px solid #ccc",
              padding: "5px",
              height: "120px",
              overflowY: "auto",
              fontSize: "0.9rem",
              marginTop: "5px",
            }}
          >
            {analysisLog.map((item, idx) => (
              <div key={idx} style={{ marginBottom: "5px" }}>
                {idx + 1}. {item}
              </div>
            ))}
          </div>
        </div>

        {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
      </div>
    </div>
  );
}
