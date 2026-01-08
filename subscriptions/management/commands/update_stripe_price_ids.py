"""
Comando para atualizar planos com Stripe Price IDs
"""
from django.core.management.base import BaseCommand
from subscriptions.models import Plan


class Command(BaseCommand):
    help = 'Atualiza planos com Stripe Price IDs'

    def handle(self, *args, **options):
        # Mapeamento de planos para Price IDs
        # Baseado nos Price IDs fornecidos pelo usuário
        price_mapping = {
            'enterprise': 'price_1Sf4JfJcxPm9Lx7v6TTz8Cnw',
            'pro': 'price_1Sf4J9JcxPm9Lx7v9NtCcRVD',
            'basico': 'price_1Sf4IvJcxPm9Lx7vXxU5I1GR',
            'trial': 'price_1Sf4IGJcxPm9Lx7vn3fxiwGo',
        }
        
        updated_count = 0
        
        for slug, price_id in price_mapping.items():
            try:
                plan = Plan.objects.get(slug=slug)
                plan.stripe_price_id_monthly = price_id
                plan.save()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'✅ Plano "{plan.name}" atualizado com Price ID: {price_id}'
                    )
                )
                updated_count += 1
            except Plan.DoesNotExist:
                self.stdout.write(
                    self.style.WARNING(
                        f'⚠️  Plano com slug "{slug}" não encontrado'
                    )
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'❌ Erro ao atualizar plano "{slug}": {str(e)}'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ {updated_count} plano(s) atualizado(s) com sucesso!'
            )
        )

