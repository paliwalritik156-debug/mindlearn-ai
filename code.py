import streamlit as st
import streamlit.components.v1 as components
import time

# ─────────────────────────────────────────
# PAGE CONFIG
# ─────────────────────────────────────────
st.set_page_config(
    page_title="MindLearn AI",
    page_icon="🧠",
    layout="wide"
)

# ─────────────────────────────────────────
# CSS (KEEP YOUR STYLE)
# ─────────────────────────────────────────
st.markdown("""
<style>
body {
    background: #0F0A00;
    color: white;
    font-family: 'Segoe UI';
}

/* NAVBAR */
.navbar {
    position: fixed;
    top: 0;
    width: 100%;
    padding: 15px 40px;
    background: rgba(0,0,0,0.7);
    backdrop-filter: blur(20px);
    display: flex;
    justify-content: space-between;
    z-index: 999;
}

.card {
    background: rgba(255,255,255,0.05);
    padding: 30px;
    border-radius: 25px;
    text-align: center;
    transition: 0.3s;
    box-shadow: 0 10px 40px rgba(0,0,0,0.6);
}

.card:hover {
    transform: translateY(-10px);
}

.stButton>button {
    background: #EA580C;
    color: white;
    border-radius: 12px;
    padding: 12px 25px;
    border: none;
    font-weight: bold;
}
</style>
""", unsafe_allow_html=True)

# ─────────────────────────────────────────
# NAVBAR
# ─────────────────────────────────────────
st.markdown("""
<div class="navbar">
    <div><b>🧠 MindLearn AI</b></div>
    <div>AI Study Assistant</div>
</div>
""", unsafe_allow_html=True)

st.markdown("<br><br><br>", unsafe_allow_html=True)

# ─────────────────────────────────────────
# SESSION
# ─────────────────────────────────────────
if "vector_store" not in st.session_state:
    st.session_state.vector_store = False

# ─────────────────────────────────────────
# HERO SECTION
# ─────────────────────────────────────────
if not st.session_state.vector_store:
    st.markdown("""
    <h1 style='text-align:center;font-size:60px;'>Your PDF just got a <span style="color:#EA580C;">Superpower</span></h1>
    <p style='text-align:center;font-size:20px;color:gray;'>Upload your notes and let AI teach you</p>
    """, unsafe_allow_html=True)

    uploaded_files = st.file_uploader("Upload PDF", type=["pdf"], accept_multiple_files=True)

    if st.button("🚀 Start Learning"):
        if uploaded_files:
            with st.spinner("Processing..."):
                time.sleep(2)
                st.session_state.vector_store = True
                st.rerun()

# ─────────────────────────────────────────
# DASHBOARD
# ─────────────────────────────────────────
else:
    st.title("📊 Dashboard")

    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("""
        <div class="card">
            <h2>💬 Chat</h2>
            <p>Ask AI anything</p>
        </div>
        """, unsafe_allow_html=True)

    with col2:
        st.markdown("""
        <div class="card">
            <h2>🧪 Quiz</h2>
            <p>Test yourself</p>
        </div>
        """, unsafe_allow_html=True)

    with col3:
        st.markdown("""
        <div class="card">
            <h2>📊 Analytics</h2>
            <p>Track progress</p>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("<br>", unsafe_allow_html=True)

    tab1, tab2, tab3 = st.tabs(["💬 Chat", "🧪 Quiz", "📊 Analytics"])

    with tab1:
        user_input = st.text_input("Ask something")
        if st.button("Send"):
            st.write("🤖 AI Response (connect your backend here)")

    with tab2:
        st.write("Quiz section coming soon...")

    with tab3:
        st.write("Analytics coming soon...")

# ─────────────────────────────────────────
# FOOTER
# ─────────────────────────────────────────
st.markdown("""
<hr>
<p style='text-align:center;color:gray;'>MindLearn AI © 2026</p>
""", unsafe_allow_html=True)