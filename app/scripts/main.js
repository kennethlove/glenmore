/* Difference Scoring:
 *
 * 1 -> 1
 * 2 -> 2
 * 3 -> 3
 * 4 -> 5
 * 5+ -> 8
 *
*/

var get_difference_score = function(difference) {
    if (difference >= 5) { return 8 }
    else if (difference <= 0) { return 0 }
    else if (difference < 4) { return difference }
    else { return 5 }
}

var round_total = function(users, number) {
    var rounds = new Backbone.Collection(),
        base_round = new GlenMore.Round({
            whiskey: null,
            tams: null,
            locations: null,
            number: number
        }),
        cats = ['whiskey', 'tams', 'locations'];
    
    users.each(function(user) {
        rounds.push(user.get('rounds').where({number: number}));
    });
    
    // Set the base round amounts
    rounds.map(function(round) {
        cats.forEach(function(cat) {
            if (!base_round.has(cat) || round.get(cat) < base_round.get(cat)) {
                base_round.set(cat, round.get(cat));
            }
        });
    });
    
    // Set each round's total
    rounds.map(function(round) {
        var round_score = 0;
        cats.forEach(function(cat) {
            round_score += get_difference_score(round.get(cat) - base_round.get(cat));
        });
        round.set('score', round_score);
    });
}

var GlenMore = new Marionette.Application();

GlenMore.addRegions({
    mainRegion: '#main',
    tabs: '#tabs',
    forms: '#forms',
    newuser: '#new_user'
});

GlenMore.Game = Backbone.RelationalModel.extend({
    defaults: {
        id: 0
    },
    relations: [{
        type: Backbone.HasMany,
        key: 'players',
        relatedModel: 'GlenMore.User'
    }]
});

GlenMore.Games = Backbone.Collection.extend({
    localStorage: new Backbone.LocalStorage('glenmore-games'),
    model: GlenMore.Game,
    nextId: function() {
        if (!this.length) return 1;
        return this.last().get('id') + 1;
    },
    save: function() {
        this.each(function(model) {
            Backbone.localSync('update', model);
        });
    },
});

GlenMore.Round = Backbone.RelationalModel.extend({
    defaults: {
        number: 1,
        whiskey: 0,
        tams: 0,
        locations: 0,
        score: 0
    },
    relations: [{
        type: Backbone.HasOne,
        key: 'user',
        relatedModel: 'GlenMore.User'
    }]
});

GlenMore.FinalScoring = Backbone.RelationalModel.extend({
    defaults: {
        special: 0,
        coins: 0,
        tiles: 0,
        victory: 0,
        total: 0
    },
    relations: [{
        type: Backbone.HasOne,
        key: 'user',
        relatedModel: 'GlenMore.User'
    }]
});

GlenMore.Rounds = Backbone.Collection.extend({
    model: GlenMore.Round
});

GlenMore.User = Backbone.RelationalModel.extend({
    defaults: {
        name: 'William Wallace',
        slug: 'william-wallace'
    },
    relations: [{
        type: Backbone.HasMany,
        key: 'rounds',
        relatedModel: 'GlenMore.Round',
        collectionType: 'GlenMore.Rounds'
    }, {
        type: Backbone.HasOne,
        key: 'final',
        relatedModel: 'GlenMore.FinalScoring'
    }, {
        type: Backbone.HasMany,
        key: 'games',
        relatedModel: 'GlenMore.Game',
        collectionType: 'GlenMore.Games'
    }]
});

GlenMore.Users = Backbone.Collection.extend({
    model: GlenMore.User,
    resetRoundTotals: function() {
        this.each(function(user) {
            user.get('rounds').each(function(round) {
                round.set('score', 0);
            });
            if (user.has('final')) {
                user.get('final').set('total', 0);
            };
        });
        this.save();
    }
});

GlenMore.TabView = Marionette.ItemView.extend({
    template: '#tab_template',
    tagName: 'li',
    events: {
        'click a': 'showUser'
    },
    showUser: function(e) {
        e.preventDefault();
        this.model.collection.trigger('user:show', this.model);
    }
});

GlenMore.UserTabs = Marionette.CollectionView.extend({
    itemView: GlenMore.TabView,
    tagName: 'ul',
    className: 'nav nav-pills nav-justified'
});

GlenMore.FormView = Marionette.ItemView.extend({
    template: '#round_form_template',
    className: 'row',
    tagName: 'fieldset',
    events: {
        'click .remove-user': 'removeUser',
        'click .new-game': 'newGame'
    },
    removeUser: function(e) {
        e.preventDefault();
        this.model.collection.trigger('user:remove', this.model);
    },
    newGame: function(e) {
        this.model.trigger('games:new');
    },
    template: function(serialized_model) {
        var template_html = $('#round_form_template').html();
        var context = {
            name: serialized_model.name,
            slug: serialized_model.slug,
            rounds: serialized_model.rounds,
            round: {number: serialized_model.rounds.length + 1}
        }
        return _.template(template_html, context);
    }
});

GlenMore.FinalFormView = Marionette.ItemView.extend({
    template: '#final_form_template',
    className: 'row',
    tagName: 'fieldset',
    template: function(serialized_model) {
        var template_html = $('#final_form_template').html();
        var context = {
            slug: serialized_model.slug,
        }
        return _.template(template_html, context);
    }
});

GlenMore.AddUserFormView = Marionette.ItemView.extend({
    template: '#add_user_form_template',
    className: 'tab-pane',
    id: 'add-user',
    events: {
        'click form .btn': 'newUser',
        'submit form': 'newUser',
        'click #calculate': 'calculate'
    },
    newUser: function(e) {
        e.preventDefault();
        var data = Backbone.Syphon.serialize(this);
        data.slug = data.name.split(' ').join('-').toLowerCase();
        this.trigger('form:submit', data);
        $(e.target).parent('form').find('input').val('');
    },
    calculate: function(e) {
        e.preventDefault();
        var users = GlenMore.game_users;
        var dummy_user = new GlenMore.User();
        
        // reset all final scores to 0
        users.each(function(user) {
            if (user.has('final')) {
                user.get('final').set('total', 0);
            }
        });
        
        // get lowest tile count from all users
        var lowest_tile = (users.map( function(user) {
            if (user.has('final')) {
                return user.get('final').get('tiles');
            } else {
                return 1
            }
        })).sort(function(a, b) { return b < a })[0];
        
        // subtract tile overages
        users.each(function(user) {
            var tiles = 1,
                penalty = 0;
            if (user.has('final')) {
                tiles = user.get('final').get('tiles');
            }
            if (tiles > lowest_tile) {
                penalty = (tiles - lowest_tile) * 3;
                var total = user.get('final').get('total');
                user.get('final').set({
                    total: total - penalty
                });
            }
        });
        
        if (users.length > 1) {

            // add in victory points, coins, and tile bonuses
            users.each(function(user) {
                if (user.has('final')) {
                    var final = user.get('final'),
                        vp = final.get('victory'),
                        coins = final.get('coins'),
                        special = final.get('special'),
                        total = final.get('total');
                        
                    final.set('total', total + vp + coins + special);
                }
            });
            
            // set final score per player
            users.each(function(user) {
                var round_total = 0;
                _.map(user.get('rounds').pluck('score'), function(r) { round_total += r});
                user.get('final').set('total', user.get('final').get('total') + round_total);
            });
            users.save();
        }
    }
});

GlenMore.UserForms = Marionette.CollectionView.extend({
    itemView: GlenMore.FormView,
    tagName: 'div',
    className: 'tab-content',
});

GlenMore.Record = Marionette.ItemView.extend({
    tagName: 'tr',
    template: '#round_template'
});

GlenMore.Records = Marionette.CompositeView.extend({
    itemView: GlenMore.Record,
    template: '#records_template',
    itemViewContainer: 'tbody',
    tagName: 'table',
    className: 'scores table table-condensed table-hover'
});

GlenMore.FinalView = Marionette.ItemView.extend({
    tagName: 'tr',
    template: '#final_row_template'
});

GlenMore.FinalRound = Marionette.CompositeView.extend({
    itemView: GlenMore.FinalView,
    template: '#final_template',
    itemViewContainer: 'tbody',
    tagName: 'table',
    className: 'scores final table table-condensed'
});

GlenMore.TotalUserView = Marionette.Layout.extend({
    template: '#user_template',
    regions: {
        rounds: '#rounds',
        final: '#final',
        total: '#total',
        form: '.score-entry'
    },
    events: {
        'submit form': 'roundFormSave',
        'click .remove-user': 'removeUser',
        'click .new-game': 'newGame'
    },
    roundFormSave: function(e) {
        e.preventDefault();
        var data = Backbone.Syphon.serialize(this);
        data['model'] = this.model;
        if (data['round-type'] === 'round') {
            this.model.trigger('round:save', data);
        } else {
            this.model.trigger('final:save', data);
        }
    },
    removeUser: function(e) {
        e.preventDefault();
        this.model.trigger('user:remove', this.model);
    },
    newGame: function(e) {
        e.preventDefault();
        this.model.trigger('game:new');
    }
});


GlenMore.on('initialize:after', function() {
    var current_game;
    
    GlenMore.games = new GlenMore.Games;
    var games = GlenMore.games;
    games.fetch();

    if (!games.length || games.length === 0) {
        games.push(new GlenMore.Game());
        current_game = games.last();
    }

    GlenMore.game_users = new GlenMore.Users;
    var users = GlenMore.game_users;

    games.on('add', function(game) {
        game.set('id', games.nextId());
        this.save(); 
    });
    
    users.on('add', function(user) {
        user.get('games').push(current_game);
        games.save();
    });
    
    users.on('user:remove', function(user) {
        deletedUser = this.get({id: user.get('id')});
        deletedUser.destroy();
        if (users.length !== 0 && users.length > 1) {
            var num_rounds = users.first().get('rounds').length;
            for (var i=1; i<=num_rounds; i++) {
                round_total(users, i);
            }
        } else {
            users.resetRoundTotals();
        }
        this.trigger('user:show', users.first());
    });
    
    users.on('round:save', function(data) {
        var user = this.get(data.model.get('id'));
        user.get('rounds').add({
            user: user,
            whiskey: parseInt(data.whiskey, 10) || 0,
            tams: parseInt(data.tams, 10) || 0,
            locations: parseInt(data.locations, 10) || 0,
            number: user.get('rounds').length + 1
        });
        this.save();
        
        var everyone = _.filter(users.models, function(other_user) {
            if (other_user.has('rounds')) {
                return other_user.get('rounds').length < user.get('rounds').length
            }
            return true;
        });;
        if (everyone.length === 0 && users.length > 1) {
            round_total(users, user.get('rounds').length);
            this.save();
        }
        
        this.trigger('user:show', user);
    });
    users.on('final:save', function(data) {
        var user = this.get(data.model.get('id'));
        var final = new GlenMore.FinalScoring({
            user: user
        });
        final.set({
            special: parseInt(data.special, 10) || 0,
            coins: parseInt(data.coins, 10) || 0,
            tiles: parseInt(data.tiles, 10) || 1,
            victory: parseInt(data.victory, 10) || 0
        });
        user.set({final: final});
        this.save();
        this.trigger('user:show', user);
    });
    users.on('user:show', function(user) {
        var totalUserView = new GlenMore.TotalUserView({
            model: user
        });
        GlenMore.forms.show(totalUserView);
        
        var userFormView = undefined;
        if (user.get('final') === null) {
            if (user.get('rounds').length === 3) {
                userFormView = new GlenMore.FinalFormView({
                    model: user
                });
            } else if (user.get('rounds').length < 3) {
                userFormView = new GlenMore.FormView({
                    model: user
                });
            }
        }
        if (userFormView !== undefined) {
            totalUserView.form.show(userFormView);
        }
        
        var scoreView = new GlenMore.Records({
            collection: user.get('rounds')
        });
        totalUserView.rounds.show(scoreView);
        
        if (user.has('final')) {
            var finalView = new GlenMore.FinalRound({
                collection: new Backbone.Collection([user.get('final')])
            });
            totalUserView.final.show(finalView);
        }
    });

    users.on('game:new', function() {
        var confirmed = confirm('This will remove all scores and users. Are you sure?');
        if (confirmed) {
            this.each(function(user) {
                user.destroy();
            });
            this.save();
            window.location.reload();
        }
    });

    var tabsView = new GlenMore.UserTabs({
        collection: users
    });
    tabsView.on('collection:rendered', function() {
        this.$el.find('li:first').addClass('active');
        if (users.length !== 0) {
            users.trigger('user:show', users.first());
        }
    });

    var addUserForm = new GlenMore.AddUserFormView();
    addUserForm.on('form:submit', function(data) {
        users.add(data);
        console.log(users);
    });

    GlenMore.tabs.show(tabsView);
    GlenMore.newuser.show(addUserForm);
});

GlenMore.start();
