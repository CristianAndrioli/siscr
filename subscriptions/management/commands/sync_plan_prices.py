"""
Comando Django para sincronizar preços dos planos com o Stripe
"""
from django.core.management.base import BaseCommand
from subscriptions.utils import sync_all_plans_from_stripe


class Command(BaseCommand):
    help = 'Sincroniza preços de todos os planos ativos com o Stripe'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Força sincronização mesmo se já foi sincronizada recentemente',
        )

    def handle(self, *args, **options):
        force = options.get('force', False)
        
        self.stdout.write('Iniciando sincronização de preços com Stripe...')
        
        result = sync_all_plans_from_stripe(force=force)
        
        if result['synced']:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✅ Sincronização concluída: {result['plans_updated']}/{result['plans_checked']} planos atualizados"
                )
            )
        else:
            reason = result.get('reason', 'unknown')
            if reason == 'cache_valid':
                self.stdout.write(
                    self.style.WARNING(
                        '⚠️  Sincronização pulada: cache ainda válido (última sincronização há menos de 5 minutos)'
                    )
                )
                self.stdout.write('Use --force para forçar sincronização')
            elif reason == 'simulated_mode':
                self.stdout.write(
                    self.style.WARNING('⚠️  Modo simulado ativo. Configure STRIPE_MODE=test ou STRIPE_MODE=live para sincronizar')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f'⚠️  Sincronização não executada: {reason}')
                )

