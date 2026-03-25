const fs = require('fs');

const files = [
    'C:\\Users\\USER\\.gemini\\antigravity\\brain\\fa9f1008-d224-4e92-a792-3245f91c46ab\\doc_server_routes.md',
    'C:\\Users\\USER\\.gemini\\antigravity\\brain\\fa9f1008-d224-4e92-a792-3245f91c46ab\\doc_server_services.md',
    'C:\\Users\\USER\\.gemini\\antigravity\\brain\\fa9f1008-d224-4e92-a792-3245f91c46ab\\doc_server_core.md',
    'C:\\Users\\USER\\.gemini\\antigravity\\brain\\fa9f1008-d224-4e92-a792-3245f91c46ab\\doc_client_components.md',
    'C:\\Users\\USER\\.gemini\\antigravity\\brain\\fa9f1008-d224-4e92-a792-3245f91c46ab\\doc_client_pages_context.md'
];

let combined = '# SentinelQuant Architecture: Complete Deep Dive\n\n';

for (const file of files) {
    combined += fs.readFileSync(file, 'utf8') + '\n\n<div style=\"page-break-after: always;\"></div>\n\n';
}

fs.writeFileSync('C:\\Users\\USER\\OneDrive\\Desktop\\Mini-Project\\SentinelQuant_Comprehensive_Architecture.md', combined);
console.log('Successfully written to SentinelQuant_Comprehensive_Architecture.md');
