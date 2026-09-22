/**
 * Modèles d'e-mails livrés avec l'application.
 *
 * Utilisés à deux endroits : l'assistant de première configuration
 * (/bienvenue) et le script de peuplement de démonstration.
 */

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    key: "quote_send",
    name: "Envoi de devis",
    category: "quote",
    subject: "Ton devis {{numero}} — {{salon}}",
    body: `Salut {{prenom}},

Merci pour ta confiance ! Voici le devis pour ton projet, que je joins en PDF à ce message.

Montant total : {{montant}}
Acompte pour bloquer la date : {{acompte}}

Tu peux consulter et accepter le devis directement en ligne ici :
{{lien}}

Dès que l'acompte est versé, je réserve ton créneau. N'hésite pas si tu as la moindre question sur le projet ou le déroulé.

À bientôt,
{{signature}}`,
    isSystem: true,
  },
  {
    key: "quote_reminder",
    name: "Relance de devis",
    category: "quote",
    subject: "Ton devis {{numero}} — tu en penses quoi ?",
    body: `Salut {{prenom}},

Je reviens vers toi au sujet du devis {{numero}} que je t'ai envoyé il y a quelques jours.

Tu peux le retrouver ici : {{lien}}

Aucune pression — dis-moi simplement si le projet te convient, si tu veux ajuster quelque chose, ou si tu préfères laisser tomber. Je préfère une réponse claire, quelle qu'elle soit.

{{signature}}`,
    isSystem: true,
  },
  {
    key: "invoice_send",
    name: "Envoi de facture",
    category: "invoice",
    subject: "Facture {{numero}} — {{salon}}",
    body: `Salut {{prenom}},

Merci pour la séance ! Tu trouveras la facture {{numero}} en pièce jointe.

Montant : {{montant}}
À régler d'ici au {{echeance}}

Le PDF contient une QR-facture : tu peux la scanner directement depuis ton application bancaire, tout se remplit automatiquement. Le paiement par TWINT reste possible aussi, dis-moi si tu préfères.

{{signature}}`,
    isSystem: true,
  },
  {
    key: "invoice_reminder",
    name: "Rappel de paiement",
    category: "invoice",
    subject: "Petit rappel — facture {{numero}}",
    body: `Salut {{prenom}},

Un petit rappel au sujet de la facture {{numero}} d'un montant de {{montant}}, dont l'échéance était fixée au {{echeance}}.

C'est probablement passé à la trappe — ça arrive. Le PDF avec la QR-facture est en pièce jointe pour te simplifier la tâche.

Si un souci se présente, écris-moi, on trouvera une solution.

{{signature}}`,
    isSystem: true,
  },
  {
    key: "appointment_confirm",
    name: "Confirmation de rendez-vous",
    category: "appointment",
    subject: "C'est confirmé — {{date_rdv}} à {{heure_rdv}}",
    body: `Salut {{prenom}},

Ton rendez-vous est confirmé :

Date : {{date_rdv}} à {{heure_rdv}}
Projet : {{projet}}
Adresse : Rue du Rhône 12, 1204 Genève

Pour que la séance se passe au mieux :
- mange correctement avant de venir, et prends de quoi grignoter
- pas d'alcool la veille ni le jour même
- porte des vêtements confortables donnant accès à la zone à tatouer
- dors bien, ça change vraiment tout

Si tu dois annuler ou reporter, préviens-moi au moins 72 heures à l'avance.

À très vite,
{{signature}}`,
    isSystem: true,
  },
  {
    key: "appointment_reminder",
    name: "Rappel de rendez-vous",
    category: "appointment",
    subject: "Rappel — on se voit {{date_rdv}}",
    body: `Salut {{prenom}},

Petit rappel : on se retrouve {{date_rdv}} à {{heure_rdv}} pour {{projet}}.

Pense à bien manger avant et à porter des vêtements adaptés à la zone.

À bientôt,
{{signature}}`,
    isSystem: true,
  },
  {
    key: "aftercare",
    name: "Conseils de cicatrisation",
    category: "aftercare",
    subject: "Les soins pour ton tatouage",
    body: `Salut {{prenom}},

Merci pour cette séance, c'était un plaisir ! Voici les soins à suivre.

Les premières 24 heures
- garde le film 2 à 4 heures, puis retire-le délicatement
- lave à l'eau tiède avec un savon doux au pH neutre, sans frotter
- sèche en tamponnant avec un essuie-tout propre, jamais de serviette

Les deux premières semaines
- applique une fine couche de crème cicatrisante 2 à 3 fois par jour
- ne gratte pas, ne décolle pas les croûtes, même si ça démange
- pas de piscine, pas de bain, pas de sauna, pas de mer
- pas d'exposition au soleil, et ensuite écran total à vie sur la zone
- douche rapide plutôt que bain prolongé

Quand me contacter
Rougeur qui s'étend, gonflement, chaleur, douleur qui augmente après 48 heures ou écoulement inhabituel : écris-moi tout de suite.

Envoie-moi une photo dans un mois, que je voie comment ça a cicatrisé. Si une retouche est nécessaire, elle est offerte.

{{signature}}`,
    isSystem: true,
  },
  {
    key: "review_request",
    name: "Demande d'avis",
    category: "aftercare",
    subject: "Ton tatouage a cicatrisé ?",
    body: `Salut {{prenom}},

Ça fait un mois environ — j'espère que ton tatouage a bien cicatrisé et qu'il te plaît toujours autant.

Deux petites choses si tu as un moment :
- envoie-moi une photo de la zone cicatrisée, ça m'aide vraiment à suivre mon travail
- si l'expérience t'a plu, un avis Google ferait une vraie différence pour le salon

Et si quelque chose ne va pas, dis-le-moi : la retouche est offerte.

Merci,
{{signature}}`,
    isSystem: true,
  },
  {
    key: "request_ack",
    name: "Accusé de réception d'une demande",
    category: "general",
    subject: "J'ai bien reçu ta demande — {{salon}}",
    body: `Salut {{prenom}},

Merci pour ta demande, elle est bien arrivée.

Je regarde tous les projets dans l'ordre d'arrivée et je reviens vers toi dans les prochains jours avec mon avis, mes disponibilités et une estimation de prix.

Si entre-temps tu as d'autres références ou des précisions à ajouter, réponds simplement à ce message.

À bientôt,
{{signature}}`,
    isSystem: true,
  },
  {
    key: "request_decline",
    name: "Refus poli d'un projet",
    category: "general",
    subject: "À propos de ton projet",
    body: `Salut {{prenom}},

Merci d'avoir pensé à moi pour ton projet.

Après réflexion, je préfère ne pas le prendre : ce n'est pas tout à fait dans mon style, et je pense qu'un autre tatoueur te rendra un bien meilleur travail. Je préfère être honnête plutôt que de te livrer quelque chose de moyen.

Si tu veux, je peux t'orienter vers quelqu'un dont c'est vraiment la spécialité — dis-moi.

Bonne continuation pour ton projet,
{{signature}}`,
    isSystem: true,
  },
];
