Como você está no editor Docker do projeto precifiq, a forma recomendada é usar um domínio ou subdomínio com HTTPS:

Crie um subdomínio, por exemplo api.seudominio.com, e adicione um registro A apontando para o IP público do VPS: 187.127.38.62.
Configuração de DNS

No YAML do projeto precifiq, substitua nas labels do Traefik o domínio padrão pelo seu subdomínio, especialmente as regras Host(...) normal e segura. Não altere a porta interna do container.
Editor YAML

Reimplante o projeto; após alguns minutos, o Traefik deverá emitir o SSL automaticamente. A URL para o Android será, por exemplo, https://api.seudominio.com/login ou https://api.seudominio.com/api/....
Labels do Traefik

Você precisará definir o domínio/subdomínio e a rota da API; sem isso, só seria possível usar o IP com uma porta, o que não é recomendado para um app Android em produção.