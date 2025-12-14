#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m'

BOLD='\033[1m'

# Icons
STOP="🛑"
DATABASE="🗄️ "
SERVER="⚡"
CHECK="✓"
ARROW="➜"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${RED}${BOLD}WHERE2MEET${NC} ${WHITE}Shutting Down${NC}                                    ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

print_status() {
    echo -e "${GRAY}${ARROW}${NC} $1"
}

print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

# Stop any running Node processes for this project
print_status "Stopping Node.js processes..."
pkill -f "tsx watch src/index.ts" 2>/dev/null
pkill -f "node dist/index.js" 2>/dev/null
print_success "Node.js processes stopped"

# Stop Docker containers
print_status "Stopping Docker containers..."
docker-compose down 2>/dev/null

if [ $? -eq 0 ]; then
    print_success "PostgreSQL container stopped"
else
    echo -e "${YELLOW}Docker containers were not running${NC}"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${STOP} ${WHITE}All services stopped${NC}                                      ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
