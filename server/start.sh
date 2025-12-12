#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

# Bold
BOLD='\033[1m'

# Icons (Unicode)
ROCKET="🚀"
DATABASE="🗄️ "
SERVER="⚡"
CHECK="✓"
ARROW="➜"
GEAR="⚙️ "

clear

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${MAGENTA}${BOLD}WHERE2MEET${NC} ${WHITE}Development Server${NC}                              ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Function to print status
print_status() {
    echo -e "${GRAY}${ARROW}${NC} $1"
}

print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}${BOLD}$1${NC}"
    echo -e "${GRAY}────────────────────────────────────────${NC}"
}

# Start Database
print_header "${DATABASE}Starting PostgreSQL Database"

print_status "Launching Docker containers..."
docker-compose up -d 2>/dev/null

if [ $? -eq 0 ]; then
    print_success "PostgreSQL is running on ${YELLOW}localhost:5432${NC}"
else
    echo -e "${RED}Failed to start Docker containers${NC}"
    exit 1
fi

# Wait for database to be ready
print_status "Waiting for database to be ready..."
sleep 2

# Check database connection
until docker-compose exec -T db pg_isready -U where2meet > /dev/null 2>&1; do
    sleep 1
done
print_success "Database connection established"

# Generate Prisma client if needed
print_header "${GEAR}Checking Prisma Client"
if [ ! -d "src/generated/prisma" ]; then
    print_status "Generating Prisma client..."
    npx prisma generate > /dev/null 2>&1
    print_success "Prisma client generated"
else
    print_success "Prisma client ready"
fi

# Start server
print_header "${SERVER}Starting Development Server"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${ROCKET} ${GREEN}${BOLD}Server starting...${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${WHITE}API:${NC}      ${YELLOW}http://localhost:3000${NC}                            ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${WHITE}Health:${NC}   ${YELLOW}http://localhost:3000/health${NC}                      ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${WHITE}Database:${NC} ${YELLOW}postgresql://localhost:5432/where2meet${NC}            ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}                                                              ${CYAN}║${NC}"
echo -e "${CYAN}║${NC}  ${GRAY}Press Ctrl+C to stop${NC}                                        ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Run dev server (this will block)
npm run dev
