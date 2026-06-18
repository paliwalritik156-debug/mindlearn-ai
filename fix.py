with open('code.py','r') as f: c=f.read()
c=c.replace('from youtube_transcript_api import YouTubeTranscriptApi\n', '')
c=c.replace('from youtube_transcript_api.formatters import TextFormatter\n', '')
if 'def get_youtube_transcript(url):\n    from youtube_transcript_api' not in c:
    c=c.replace('def get_youtube_transcript(url):', 'def get_youtube_transcript(url):\n    from youtube_transcript_api import YouTubeTranscriptApi')
c=c.replace('from langchain.chains.retrieval import create_retrieval_chain\n', '')
c=c.replace('from langchain.chains import create_retrieval_chain\n', '')
c=c.replace('from langchain.chains.combine_documents import create_stuff_documents_chain\n', '')
if 'from langchain_core.output_parsers import StrOutputParser' not in c:
    c=c.replace('from langchain_core.prompts import ChatPromptTemplate, PromptTemplate', 'from langchain_core.prompts import ChatPromptTemplate, PromptTemplate\nfrom langchain_core.output_parsers import StrOutputParser')
with open('code.py','w') as f: f.write(c)
print('All fixed!')
