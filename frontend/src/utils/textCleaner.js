export const cleanTextForSpeech = (text) => {
  if (!text) return '';
  
  return text
    // Remove markdown bold/italic
    .replace(/\*\*\*(.*?)\*\*\*/g, '$1')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\_\_(.*?)\_\_/g, '$1')
    .replace(/\_(.*?)\_/g, '$1')
    
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, '')
    
    // Remove code blocks
    .replace(/``````/g, '')
    .replace(/`(.*?)`/g, '$1')
    
    // Remove links but keep text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    
    // Remove special symbols
    .replace(/[\/\\|<>{}[\]()]/g, ' ')
    .replace(/[~`]/g, '')
    
    // Clean up spaces
    .replace(/\s+/g, ' ')
    .trim();
};
