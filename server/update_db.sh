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
NC='\033[0m'

BOLD='\033[1m'

# Icons
DATABASE="🗄️ "
MIGRATE="📦"
CHECK="✓"
ARROW="➜"
WARNING="⚠️ "

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${MAGENTA}${BOLD}WHERE2MEET${NC} ${WHITE}Database Migration${NC}                              ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

print_status() {
    echo -e "${GRAY}${ARROW}${NC} $1"
}

print_success() {
    echo -e "${GREEN}${CHECK}${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}${WARNING}${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}${BOLD}$1${NC}"
    echo -e "${GRAY}────────────────────────────────────────${NC}"
}

# Check if Docker is running
print_header "${DATABASE}Checking Database Connection"

if ! docker-compose ps | grep -q "Up"; then
    print_warning "Database container is not running"
    print_status "Starting Docker containers..."
    docker-compose up -d 2>/dev/null
    sleep 3
fi

# Wait for database
print_status "Connecting to database..."
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done
print_success "Database connection established"

# Migration options
print_header "${MIGRATE}Migration Options"

echo ""
echo -e "  ${WHITE}1)${NC} ${CYAN}migrate dev${NC}    - Create migration file (recommended for dev)"
echo -e "  ${WHITE}2)${NC} ${CYAN}db push${NC}        - Push schema directly (quick, no migration file)"
echo -e "  ${WHITE}3)${NC} ${CYAN}reset${NC}          - Reset database (${RED}DESTRUCTIVE${NC})"
echo -e "  ${WHITE}4)${NC} ${CYAN}generate${NC}       - Regenerate Prisma client only"
echo -e "  ${WHITE}5)${NC} ${GRAY}cancel${NC}"
echo ""

read -p "Select option [1-5]: " choice

case $choice in
    1)
        print_header "Running: prisma migrate dev"
        echo ""
        read -p "Migration name (optional): " migration_name
        if [ -n "$migration_name" ]; then
            npx prisma migrate dev --name "$migration_name"
        else
            npx prisma migrate dev
        fi
        ;;
    2)
        print_header "Running: prisma db push"
        print_warning "This will push schema changes without creating a migration file"
        echo ""
        read -p "Continue? [y/N]: " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            npx prisma db push
        else
            echo -e "${GRAY}Cancelled${NC}"
        fi
        ;;
    3)
        print_header "Running: prisma migrate reset"
        echo -e "${RED}${BOLD}WARNING: This will delete ALL data in the database!${NC}"
        echo ""
        read -p "Are you sure? Type 'reset' to confirm: " confirm
        if [ "$confirm" = "reset" ]; then
            npx prisma migrate reset
        else
            echo -e "${GRAY}Cancelled${NC}"
        fi
        ;;
    4)
        print_header "Running: prisma generate"
        npx prisma generate
        print_success "Prisma client regenerated"
        ;;
    5|*)
        echo -e "${GRAY}Cancelled${NC}"
        exit 0
        ;;
esac

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}  ${CHECK} ${GREEN}Database operation completed${NC}                              ${CYAN}║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
