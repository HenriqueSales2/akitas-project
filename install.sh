#!/bin/bash
# ===== Instalação do Backend Node.js (Akitas Barbearia) =====
# Execute: bash install.sh

set -e

echo "🪒 Instalando dependências do backend..."

# Verifica Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale em https://nodejs.org/"
    exit 1
fi

echo "✓ Node.js: $(node --version)"

# Instala dependências
npm install


echo ""
echo "✅ Instalação concluída!"
echo ""
echo "Para rodar o servidor:"
echo "  npm start"
echo ""
echo "Para instalar em produção (como serviço):"
echo "  npm install -g pm2"
echo "  pm2 start server.js --name 'akitas-barbearia'"
echo ""
echo "O banco de dados será criado em: agendamentos.db"
echo "Acesse o site em: http://localhost:3000"